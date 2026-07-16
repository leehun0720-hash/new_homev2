/* =====================================================================
   Firebase 설정 파일
   ---------------------------------------------------------------------
   1) https://console.firebase.google.com 에서 프로젝트 생성
   2) [프로젝트 설정 > 일반 > 내 앱 > 웹 앱 추가] 후 아래 값 붙여넣기
   3) [Firestore Database > 데이터베이스 만들기] 실행
   4) Firestore 규칙(테스트용 예시 — 운영 시 반드시 강화):

      rules_version = '2';
      service cloud.firestore {
        match /databases/{database}/documents {
          match /site/{doc}  { allow read: if true; allow write: if true; }
          match /posts/{doc} { allow read: if true; allow write: if true; }
          match /qna/{doc}   { allow read, create: if true; allow update, delete: if true; }
        }
      }

   ※ 아래 값이 placeholder(YOUR_...) 상태이면 사이트는 자동으로
     "로컬 모드"(브라우저 localStorage 저장)로 동작합니다.
   ===================================================================== */
window.FIREBASE_CONFIG = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};
