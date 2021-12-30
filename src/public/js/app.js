const socket = io();

const myFace = document.getElementById("myFace");
const muteBtn = document.getElementById("mute");
const cameraBtn = document.getElementById("camera");
const camerasSelect = document.getElementById("cameras");
const call = document.getElementById("call");

call.hidden = true;

let myStream;
let muted = false;
let cameraOff = false;
let roomName;
let myPeerConnection;

async function getCameras() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cameras = devices.filter((device) => device.kind === "videoinput");
    // 현재 선택된 카메라를 알려주는 getVideoTracks()함수를 사용
    const currentCamera = myStream.getVideoTracks()[0];
    cameras.forEach((camera) => {
      const option = document.createElement("option");
      option.value = camera.deviceId;
      option.innerText = camera.label;
      if (currentCamera.label === camera.label) {
        option.selected = true;
      }
      camerasSelect.appendChild(option);
    });
  } catch (e) {
    console.log(e);
  }
}

// 선택한 카메라의 아이디를 받아서 작업
async function getMedia(deviceId) {
  // 카메라의 id를 가지지 않는 설정
  const initialConstrains = {
    audio: true,
    // 셀카모드
    video: { facingMode: "user" },
  };
  // 지정한 카메라를 설정(지정한 카메라 id가 있을 때)
  const cameraConstrains = {
    audio: true,
    video: { deviceId: { exact: deviceId } },
  };
  try {
    myStream = await navigator.mediaDevices.getUserMedia(
      // 지정한 카메라가 있다면 cameraConstrains를 사용
      deviceId ? cameraConstrains : initialConstrains
    );
    myFace.srcObject = myStream;
    // 가장 처음에 카메를 지정하지 않았을 때만 불러옴, 안그러면 계속 불러와서 option이 중복됨
    if (!deviceId) {
      await getCameras();
    }
  } catch (e) {
    console.log(e);
  }
}

function handleMuteClick() {
  myStream
    .getAudioTracks()
    .forEach((track) => (track.enabled = !track.enabled));
  if (!muted) {
    muteBtn.innerText = "Unmute";
    muted = true;
  } else {
    muteBtn.innerText = "Mute";
    muted = false;
  }
}
function handleCameraClick() {
  myStream
    .getVideoTracks()
    .forEach((track) => (track.enabled = !track.enabled));
  if (cameraOff) {
    cameraBtn.innerText = "Turn Camera Off";
    cameraOff = false;
  } else {
    cameraBtn.innerText = "Turn Camera On";
    cameraOff = true;
  }
}

async function handleCameraChange() {
  // 선택한 카메라의 id를 넣어줌
  await getMedia(camerasSelect.value);
}

muteBtn.addEventListener("click", handleMuteClick);
cameraBtn.addEventListener("click", handleCameraClick);
camerasSelect.addEventListener("input", handleCameraChange);

// Welcome Form (join a room)

const welcome = document.getElementById("welcome");
const welcomeForm = welcome.querySelector("form");

async function initCall() {
  welcome.hidden = true;
  call.hidden = false;
  await getMedia();
  makeConnection();
}

// 참가하는 사람이 보내는 코드
async function handleWelcomeSubmit(event) {
  event.preventDefault();
  const input = welcomeForm.querySelector("input");
  // initCall을 완수하기 전에 myPeerConnection이 수행되어 error 발생하기 때문에 수정
  await initCall();
  socket.emit("join_room", input.value);
  roomName = input.value;
  input.value = "";
}

welcomeForm.addEventListener("submit", handleWelcomeSubmit);

// socket code

// 방을 만든 사람이 방에 참여한 사람에게 보내는 코드
socket.on("welcome", async () => {
  // 우리가 누구이며 어디에 있다는 등을 알려주는 초대장
  const offer = await myPeerConnection.createOffer();
  myPeerConnection.setLocalDescription(offer);
  console.log("sent the offer!");
  socket.emit("offer", offer, roomName);
});

// 방에 참가한 사람이 받게 되는 코드
socket.on("offer", async (offer) => {
  console.log("recived offer");
  myPeerConnection.setRemoteDescription(offer);
  const answer = await myPeerConnection.createAnswer();
  myPeerConnection.setLocalDescription(answer);
  console.log("send answer");
  socket.emit("answer", answer, roomName);
});

socket.on("answer", (answer) => {
  console.log("recived answer");
  myPeerConnection.setRemoteDescription(answer);
});

// 처음에 참가자가 ice를 받고 다시 돌려보내면 방에 있는 사람들이 ice를 받음
socket.on("ice", (ice) => {
  console.log("recived ice:", ice);
  myPeerConnection.addIceCandidate(ice);
});

// RTC code

// 실제 연결을 만드는 함수
function makeConnection() {
  // peer-to-peer connection
  myPeerConnection = new RTCPeerConnection();
  myPeerConnection.addEventListener("icecandidate", handleIce);
  myPeerConnection.addEventListener("addstream", handleAddStream);
  // video, audio stream을 전송
  myStream
    .getTracks()
    .forEach((track) => myPeerConnection.addTrack(track, myStream));
}

// 처음 방에 있는 사람들이 answer를 받으면 ice를 전송함
// 그리고 참가자가 ice를 받으면 참가자도 ice를 보냄
function handleIce(data) {
  console.log("send candidate:", data.candidate);
  socket.emit("ice", data.candidate, roomName);
}

function handleAddStream(data) {
  console.log("fire addStream");
  const peerFace = document.getElementById("peerFace");
  peerFace.srcObject = data.stream;
}
