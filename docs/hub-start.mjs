import {installSso} from './hub-client.mjs?v=20261023-background';
const start=()=>installSso({appId:"desk",...{"brokerUrl":"https://asia-northeast3-fir-lms-prod.cloudfunctions.net/hubSsoApi","hubOrigins":["https://sedubanpo.github.io"]},...window.SeduHubAdapter});
// Module scripts execute after parsing. Do not wait for images or hidden-frame
// load completion before starting the authentication handshake.
start().catch(() => console.warn('허브 로그인 연결을 시작하지 못했습니다.'));
