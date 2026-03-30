let ws = null;
let localStream = null;
let peerConnection = null;
let currentTargetId = "";

const $ = (id) => document.getElementById(id);

const myIdInput = $("myId");
const targetIdInput = $("targetId");
const connectBtn = $("connectBtn");
const startCameraBtn = $("startCameraBtn");
const callBtn = $("callBtn");
const hangupBtn = $("hangUpBtn");
const localVideo = $("localVideo");
const remoteVideo = $("remoteVideo");
const logBox = $("log");

function log(message) {
  logBox.textContent = message + "\n";
}
function sendSignal(to_user_id, type, data) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return;
  }

  const payload = {
    to_user_id: to_user_id,
    type: type,
    data: data,
  };
  ws.send(JSON.stringify(payload));
}
function createPeerConnection() {
  const pc = new RTCPeerConnection({
    iceServers: [
      {
        urls: "stun:stun.l.google.com:19302",
      },
    ],
  });

  pc.onicecandidate = function (event) {
    if (event.candidate && currentTargetId) {
      sendSignal(currentTargetId, "ice", {
        candidate: event.candidate,
      });
      log("Đã gửi ICE candidate");
    }
  };

  pc.ontrack = function (event) {
    log("Đã nhận remote stream");
    remoteVideo.srcObject = event.streams[0];
  };

  pc.onconnectionstatechange = function () {
    log("Connection state: " + pc.connectionState);
  };

  if (localStream) {
    localStream.getTracks().forEach(function (track) {
      pc.addTrack(track, localStream);
    });
  }

  return pc;
}
async function startCamera() {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      log(
        `Trình duyệt hiện tại không hỗ trợ camera trong ngữ cảnh này.
Hãy dùng HTTPS hoặc localhost.`,
      );
      return;
    }

    localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });

    localVideo.srcObject = localStream;
    log("Đã mở camera/micro");
  } catch (error) {
    log("Lỗi mở camera: " + error.message);
  }
}
function addLocalTracksToPeerConnection(pc) {
  if (!localStream) return;

  const senders = pc.getSenders();
  const existingTrackIds = senders
    .filter((sender) => sender.track)
    .map((sender) => sender.track.id);

  localStream.getTracks().forEach((track) => {
    if (!existingTrackIds.includes(track.id)) {
      pc.addTrack(track, localStream);
    }
  });
}
function connectSignaling() {
  const myId = myIdInput.value.trim();
  if (!myId) {
    log("Vui lòng nhập ID của User 01");
    return;
  }
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const wsUrl =
    protocol + "://" + window.location.host + "/ws/signaling?user=" + encodeURIComponent(myId);
  ws = new WebSocket(wsUrl);
  ws.onopen = function () {
    log("Đã kết nối signaling server");
  };
  ws.onmessage = async function (event) {
    log("Nhận signal: " + event.data);
    const msg = JSON.parse(event.data);
    const fromUser = msg.from;
    const type = msg.type;
    const data = msg.data;
    currentTargetId = fromUser;
    if (type === "offer") {
      log("Nhận offer từ " + fromUser);
      if (!localStream) {
        await startCamera();
      }

      if (!peerConnection) {
        peerConnection = createPeerConnection();
      } else {
        addLocalTracksToPeerConnection(peerConnection);
      }

      await peerConnection.setRemoteDescription(
        new RTCSessionDescription(data),
      );

      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      sendSignal(fromUser, "answer", peerConnection.localDescription);

      log("Đã gửi answer về " + fromUser);
    } else if (type === "answer") {
      await peerConnection.setRemoteDescription(
        new RTCSessionDescription(data),
      );
      log("Nhận answer từ " + fromUser);
    } else if (type === "ice") {
      log("Nhận ICE từ " + fromUser);
      if (data && data.candidate) {
        try {
          await peerConnection.addIceCandidate(
            new RTCSessionDescription(data.candidate),
          );
        } catch (err) {
          log("Lỗi xay ra khi thêm ICE candidate: " + err.message);
        }
      }
    }
  };
  ws.onerror = function (error) {
    log("WebSocket error");
    console.error(error);
  };
  ws.onclose = function () {
    log("WebSocket đã đóng");
  };
}
async function makeCall() {
  const targetId = targetIdInput.value.trim();
  if (!targetId) {
    log("Hãy nhập User ID để gọi");
    return;
  }

  if (!localStream) {
    log("Hãy mở camera trước");
    return;
  }

  if (!ws || ws.readyState !== WebSocket.OPEN) {
    log("Hãy kết nối signaling trước");
    return;
  }

  currentTargetId = targetId;
  if (!peerConnection) {
    peerConnection = createPeerConnection();
  }

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  sendSignal(targetId, "offer", peerConnection.localDescription);
  log("Đã gửi offer tới " + targetId);
}
function hangUp() {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  log("Đã ngắt cuộc gọi");
}

connectBtn.addEventListener("click", connectSignaling);
startCameraBtn.addEventListener("click", startCamera);
callBtn.addEventListener("click", makeCall);
hangupBtn.addEventListener("click", hangUp);