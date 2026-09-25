(async function(){
'use strict';
const login=document.getElementById('trainingLogin'),root=document.getElementById('trainingRoot'),message=document.getElementById('trainingLoginStatus'),logout=document.getElementById('trainingLogout');
try {
const app=firebase.initializeApp({apiKey:'AIzaSyCFM21ZxgwIYwmjRPaAOp5bL9Kprqiyppg',authDomain:'fir-lms-prod.firebaseapp.com',projectId:'fir-lms-prod'},'desk-training');
const auth=app.auth();await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);
auth.onAuthStateChanged(user=>{root._trainingAbort?.abort();root.innerHTML='';root.hidden=!user;login.hidden=!!user;logout.hidden=!user;if(user)DeskTraining.mount(root,{getToken:()=>auth.currentUser?.getIdToken()});});
logout.addEventListener('click',()=>auth.signOut());
login.addEventListener('submit',async e=>{e.preventDefault();const button=login.querySelector('button');button.disabled=true;message.textContent='로그인 중입니다…';try{let email=document.getElementById('trainingLoginId').value.trim();if(!email.includes('@')){let number=email.replace(/\D/g,'');if(number.length===8)number='010'+number;if(number.length===10&&number[0]!=='0')number='0'+number;const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(number));const key=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');const alias=await app.firestore().collection('loginAliases').doc(key).get();if(!alias.exists||alias.data().active===false)throw Error('등록된 아이디를 확인해 주세요.');email=alias.data().email;}await auth.signInWithEmailAndPassword(email,document.getElementById('trainingPassword').value);document.getElementById('trainingPassword').value='';message.textContent='';}catch(e){message.textContent=e.code?'아이디와 비밀번호를 확인해 주세요.':e.message;}finally{button.disabled=false;}});
}catch(e){message.textContent='로그인 화면을 불러오지 못했습니다. 페이지를 새로고침해 주세요.';}
})();
