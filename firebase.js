
(async function(){
  function loadScript(src){
    return new Promise(function(resolve, reject){
      const s = document.createElement('script');
      s.src = src;
      s.onload = function(){ resolve(); };
      s.onerror = function(){ reject(new Error(src)); };
      document.head.appendChild(s);
    });
  }

  const FB_URLS = [
    'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js',
    'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js'
  ];

  async function loadFirebaseScripts(maxRetries){
    for(let attempt=0; attempt<=maxRetries; attempt++){
      try{
        for(let i=0;i<FB_URLS.length;i++){
          const url = attempt===0 ? FB_URLS[i] : (FB_URLS[i] + '?retry=' + attempt + '_' + Date.now());
          await loadScript(url);
        }
        return true; // 3개 다 성공
      } catch(e){
        console.warn('Firebase 스크립트 로드 실패 (시도 ' + (attempt+1) + '/' + (maxRetries+1) + '):', e.message);
        if(attempt<maxRetries) await new Promise(function(r){ setTimeout(r, 700*(attempt+1)); });
      }
    }
    return false; // 전부 실패
  }

  // Firebase 로딩 전/실패 시에도 버튼 클릭이 에러 없이 동작하도록 우선 안전한 기본값 지정
  let fbLoadFailed = false;
  let fbFailDetail = '';
  window._authSubmit = function(mode){
    const errEl = document.getElementById('authError');
    if(!errEl) return;
    errEl.style.display = 'block';
    errEl.textContent = fbLoadFailed
      ? ('로그인 시스템을 불러오지 못했어요.' + (fbFailDetail?(' ('+fbFailDetail+')'):'') + ' 인터넷 연결, 광고 차단기, 학교/회사 네트워크의 사이트 차단 설정을 확인한 뒤 아래 "다시 시도" 버튼을 눌러주세요.')
      : '로그인 시스템을 불러오는 중이에요. 잠시 후 다시 눌러주세요.';
  };
  // 로딩 실패 후 수동 재시도용 (모달에 "다시 시도" 버튼에서 호출)
  window._retryFirebaseInit = function(){ initFirebase(); };

  async function initFirebase(){
   try {
    if(typeof firebase === 'undefined'){
      const ok = await loadFirebaseScripts(2); // 총 3회 시도
      if(!ok || typeof firebase === 'undefined'){
        throw new Error('firebase-app / firebase-auth / firebase-firestore 스크립트를 여러 번 재시도해도 불러오지 못함');
      }
    }

    const firebaseConfig = {
      apiKey: "AIzaSyCX-czqkQcPEhefFTdw4VM6CorrZGs2_UE",
      authDomain: "dmdkr-4ad74.firebaseapp.com",
      projectId: "dmdkr-4ad74",
      storageBucket: "dmdkr-4ad74.firebasestorage.app",
      messagingSenderId: "25040159563",
      appId: "1:25040159563:web:56b8f7de266e0e2a811ece"
    };

    if(!firebase.apps || !firebase.apps.length){
      firebase.initializeApp(firebaseConfig);
    }
    const auth = firebase.auth();
    const db   = firebase.firestore();

    window._fbUser = null;

    // 게임 점수/재화 저장용 (awardCurrency에서 호출)
    // ⚠ 예전엔 로컬에서 계산한 절대값을 merge로 그대로 덮어써서,
    //   getDoc()으로 서버값을 불러오는 도중에 보상이 지급되면 값이 씹히는
    //   경쟁 상태(race condition)가 있었음. increment()로 서버측에서
    //   원자적으로 더하도록 변경해서 순서와 무관하게 항상 정확히 반영되게 함.
    window._fbAddCurrency = function(uid, goldDelta, diaDelta){
      const inc = firebase.firestore.FieldValue.increment;
      return db.collection('users').doc(uid).set({
        gold: inc(goldDelta),
        diamond: inc(diaDelta)
      }, { merge:true }).catch(err => console.error('저장 실패:', err));
    };

    window._fbSignIn = function(){
      const email = document.getElementById('authEmail').value.trim();
      const pw    = document.getElementById('authPassword').value;
      if(!email || !pw) return Promise.reject({ code:'auth/missing-fields', message:'이메일과 비밀번호를 입력해주세요.' });
      return auth.signInWithEmailAndPassword(email, pw);
    };

    window._fbSignUp = function(){
      const email = document.getElementById('authEmail').value.trim();
      const pw    = document.getElementById('authPassword').value;
      if(!email || !pw) return Promise.reject({ code:'auth/missing-fields', message:'이메일과 비밀번호를 입력해주세요.' });
      if(pw.length < 6) return Promise.reject({ code:'auth/weak-password', message:'비밀번호는 6자 이상이어야 해요.' });
      return auth.createUserWithEmailAndPassword(email, pw);
    };

    window._fbSignOut = function(){ return auth.signOut(); };

    // 실제 구현으로 위의 안전 기본값을 교체
    window._authSubmit = function(mode){
      const errEl = document.getElementById('authError');
      if(errEl){ errEl.style.display='none'; errEl.textContent=''; }
      const action = mode === 'signup' ? window._fbSignUp : window._fbSignIn;
      action().catch(function(e){
        const codeMsgs = {
          'auth/invalid-email':'이메일 형식이 올바르지 않아요.',
          'auth/user-not-found':'가입되지 않은 이메일이에요.',
          'auth/wrong-password':'비밀번호가 올바르지 않아요.',
          'auth/invalid-credential':'이메일 또는 비밀번호가 올바르지 않아요.',
          'auth/email-already-in-use':'이미 가입된 이메일이에요.',
          'auth/weak-password':'비밀번호는 6자 이상이어야 해요.',
          'auth/missing-fields':'이메일과 비밀번호를 입력해주세요.',
          'auth/too-many-requests':'시도가 너무 많아요. 잠시 후 다시 시도해주세요.'
        };
        const msg = codeMsgs[e.code] || ('오류가 발생했어요: ' + (e.message || e));
        if(errEl){ errEl.textContent = msg; errEl.style.display='block'; }
      });
    };

    auth.onAuthStateChanged(function(user){
      window._fbUser = user;
      const loggedOut = document.getElementById('authLoggedOut');
      const loggedIn  = document.getElementById('authLoggedIn');
      const emailEl   = document.getElementById('authEmailDisplay');

      if(user){
        if(loggedOut) loggedOut.style.display='none';
        if(loggedIn)  loggedIn.style.display='flex';
        if(emailEl)   emailEl.textContent = user.email;

        db.collection('users').doc(user.uid).get().then(function(snap){
          if(snap.exists){
            const d = snap.data();
            window._userGold = d.gold || 0;
            window._userDia  = d.diamond || 0;
          } else {
            window._userGold = 0;
            window._userDia  = 0;
            return db.collection('users').doc(user.uid).set({ gold:0, diamond:0, email:user.email }, { merge:true });
          }
        }).catch(function(e){
          console.error('유저 데이터 불러오기 실패:', e);
        }).finally(function(){
          if(typeof updateCurrencyUI === 'function') updateCurrencyUI();
        });

        const modal = document.getElementById('authModal');
        if(modal) modal.style.display='none';
      } else {
        if(loggedOut) loggedOut.style.display='flex';
        if(loggedIn)  loggedIn.style.display='none';
        window._userGold = 0;
        window._userDia  = 0;
        if(typeof updateCurrencyUI === 'function') updateCurrencyUI();
      }
    });

  } catch(e) {
    fbLoadFailed = true;
    fbFailDetail = (e && e.message) || String(e);
    console.error('Firebase 초기화 실패:', e);
  }
  } // end initFirebase

  await initFirebase();
})();
