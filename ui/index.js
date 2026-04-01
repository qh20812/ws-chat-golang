let ws = null;
let localStream = null;
let peerConnection = null;
let currentTargetId = "";
let currentUser = null;
let friends = [];

const authToken = localStorage.getItem("auth_token");

const $ = (id) => document.getElementById(id);

const myIdentity = $("myIdentity");
const friendSelect = $("friendSelect");
const connectBtn = $("connectBtn");
const startCameraBtn = $("startCameraBtn");
const callBtn = $("callBtn");
const hangupBtn = $("hangUpBtn");
const localVideo = $("localVideo");
const remoteVideo = $("remoteVideo");
const localPreview = $("localPreview");
const videoStage = $("videoStage");
const eventFeed = $("eventFeed");
const wsStatus = $("wsStatus");
const cameraStatus = $("cameraStatus");
const callStatus = $("callStatus");
const navLogout = $("navLogout");

if (!authToken) {
  window.location.href = "/ui/login/index.html";
}

function pushEvent(message, level = "neutral") {
  const item = document.createElement("div");
  item.className = `event-item ${level}`;
  item.textContent = `${new Date().toLocaleTimeString()} - ${message}`;
  eventFeed.prepend(item);
  while (eventFeed.children.length > 6) {
    eventFeed.removeChild(eventFeed.lastChild);
  }
}

function setStatus(el, text, state) {
  el.textContent = text;
  el.className = `status-pill ${state}`;
}

function sendSignal(toUserID, type, data) {
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    pushEvent("Signaling chưa sẵn sàng", "error");
    return;
  }

  ws.send(
    JSON.stringify({
      to_user_id: toUserID,
      type: type,
      data: data,
    }),
  );
}

function addLocalTracksToPeerConnection(pc) {
  if (!localStream) {
    return;
  }

  const existingTrackIds = pc
    .getSenders()
    .filter((sender) => sender.track)
    .map((sender) => sender.track.id);

  localStream.getTracks().forEach((track) => {
    if (!existingTrackIds.includes(track.id)) {
      pc.addTrack(track, localStream);
    }
  });
}

function createPeerConnection() {
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  });

  pc.onicecandidate = (event) => {
    if (event.candidate && currentTargetId) {
      sendSignal(currentTargetId, "ice", { candidate: event.candidate });
      pushEvent("ICE candidate sent", "success");
    }
  };

  pc.ontrack = (event) => {
    remoteVideo.srcObject = event.streams[0];
    pushEvent("Remote stream connected", "success");
    setStatus(callStatus, "Call: Connected", "success");
  };

  pc.onconnectionstatechange = () => {
    const state = pc.connectionState;
    if (state === "connected") {
      setStatus(callStatus, "Cuộc gọi: Đã kết nối", "success");
    } else if (state === "failed" || state === "disconnected") {
      setStatus(callStatus, `Cuộc gọi: ${state}`, "error");
    } else {
      setStatus(callStatus, `Cuộc gọi: ${state}`, "neutral");
    }
    pushEvent(`Peer state: ${state}`, state === "failed" ? "error" : "neutral");
  };

  addLocalTracksToPeerConnection(pc);
  return pc;
}

async function startCamera() {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      pushEvent("Trình duyệt không hỗ trợ camera trong ngữ cảnh này", "error");
      setStatus(cameraStatus, "Camera: Không hỗ trợ", "error");
      return;
    }

    localStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: true,
    });

    localVideo.srcObject = localStream;
    setStatus(cameraStatus, "Camera: Ready", "success");
    pushEvent("Camera started", "success");
  } catch (error) {
    setStatus(cameraStatus, "Camera: Lỗi", "error");
    pushEvent("Không thể bật camera: " + error.message, "error");
  }
}

function connectSignaling() {
  if (!currentUser || !currentUser.id) {
    pushEvent("Người dùng hiện tại chưa tải được", "error");
    return;
  }

  if (ws && ws.readyState === WebSocket.OPEN) {
    pushEvent("Đã kết nối signaling", "neutral");
    return;
  }

  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const wsUrl =
    `${protocol}://${window.location.host}/ws/signaling?user=${encodeURIComponent(currentUser.id)}`;
  ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    setStatus(wsStatus, "Signaling: Đã kết nối", "success");
    pushEvent("Kết nối signaling thành công", "success");
  };

  ws.onmessage = async (event) => {
    const msg = JSON.parse(event.data);
    const fromUser = msg.from;
    const type = msg.type;
    const data = msg.data;
    currentTargetId = fromUser;

    if (type === "offer") {
      pushEvent(`Có cuộc gọi đến từ ${fromUser}`, "neutral");
      setStatus(callStatus, "Cuộc gọi: Đang đến", "neutral");

      if (!localStream) {
        await startCamera();
      }

      if (!peerConnection) {
        peerConnection = createPeerConnection();
      } else {
        addLocalTracksToPeerConnection(peerConnection);
      }

      await peerConnection.setRemoteDescription(new RTCSessionDescription(data));

      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      sendSignal(fromUser, "answer", peerConnection.localDescription);
      pushEvent(`Đã gửi trả lời tới ${fromUser}`, "success");
    } else if (type === "answer") {
      await peerConnection.setRemoteDescription(new RTCSessionDescription(data));
      pushEvent(`Đã nhận trả lời từ ${fromUser}`, "success");
      setStatus(callStatus, "Cuộc gọi: Đang kết nối", "neutral");
    } else if (type === "ice") {
      if (data && data.candidate && peerConnection) {
        try {
          await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (err) {
          pushEvent("ICE error: " + err.message, "error");
        }
      }
    }
  };

  ws.onerror = () => {
  setStatus(wsStatus, "Signaling: Lỗi", "error");
  pushEvent("Lỗi WebSocket", "error");
  };

  ws.onclose = () => {
    setStatus(wsStatus, "Signaling: Đã đóng", "error");
    pushEvent("WebSocket đã đóng", "error");
  };
}

async function makeCall() {
  const targetId = friendSelect.value;
  if (!targetId) {
    pushEvent("Vui lòng chọn bạn bè trước khi gọi", "error");
    return;
  }

  if (!localStream) {
    pushEvent("Vui lòng bật camera trước khi gọi", "error");
    return;
  }

  if (!ws || ws.readyState !== WebSocket.OPEN) {
    pushEvent("Vui lòng kết nối signaling trước", "error");
    return;
  }

  currentTargetId = targetId;
  if (!peerConnection) {
    peerConnection = createPeerConnection();
  }

  const offer = await peerConnection.createOffer();
  await peerConnection.setLocalDescription(offer);
  sendSignal(targetId, "offer", peerConnection.localDescription);
  setStatus(callStatus, "Cuộc gọi: Đang đổ chuông", "neutral");
  pushEvent("Đã gửi lời mời cuộc gọi", "success");
}

function hangUp() {
  if (peerConnection) {
    peerConnection.close();
    peerConnection = null;
  }
  remoteVideo.srcObject = null;
  setStatus(callStatus, "Cuộc gọi: Kết thúc", "error");
  pushEvent("Cuộc gọi đã kết thúc", "neutral");
}

function renderFriendOptions() {
  friendSelect.innerHTML = `<option value="">-- Chọn bạn bè --</option>`;
  friends.forEach((friend) => {
    const option = document.createElement("option");
    option.value = friend.id;
    option.textContent = `${friend.username} (${friend.email})`;
    friendSelect.appendChild(option);
  });
}

async function loadCurrentUser() {
  const res = await fetch("/api/myprofile", {
    headers: { Authorization: "Bearer " + authToken },
  });

  if (!res.ok) {
    window.location.href = "/ui/login/index.html";
    return;
  }

  currentUser = await res.json();
  myIdentity.textContent = `Signed in as ${currentUser.username} (${currentUser.email})`;
}

async function loadFriends() {
  const res = await fetch("/api/friend/myfriends", {
    headers: { Authorization: "Bearer " + authToken },
  });

  if (!res.ok) {
    pushEvent("Không thể tải danh sách bạn bè", "error");
    return;
  }

  const data = await res.json();
  friends = data.friends || [];
  renderFriendOptions();

  if (friends.length === 0) {
    pushEvent("You have no friends to call yet", "neutral");
  } else {
    pushEvent(`Loaded ${friends.length} friend(s)`, "success");
  }
}

function setupDraggableLocalPreview() {
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let startLeft = 0;
  let startTop = 0;

  localPreview.addEventListener("pointerdown", (event) => {
    isDragging = true;
    localPreview.setPointerCapture(event.pointerId);
    startX = event.clientX;
    startY = event.clientY;
    const rect = localPreview.getBoundingClientRect();
    const stageRect = videoStage.getBoundingClientRect();
    startLeft = rect.left - stageRect.left;
    startTop = rect.top - stageRect.top;
    localPreview.classList.add("dragging");
  });

  localPreview.addEventListener("pointermove", (event) => {
    if (!isDragging) {
      return;
    }

    const stageRect = videoStage.getBoundingClientRect();
    const previewRect = localPreview.getBoundingClientRect();
    let nextLeft = startLeft + (event.clientX - startX);
    let nextTop = startTop + (event.clientY - startY);

    nextLeft = Math.max(8, Math.min(nextLeft, stageRect.width - previewRect.width - 8));
    nextTop = Math.max(8, Math.min(nextTop, stageRect.height - previewRect.height - 8));

    localPreview.style.left = `${nextLeft}px`;
    localPreview.style.top = `${nextTop}px`;
    localPreview.style.right = "auto";
  });

  const stopDragging = () => {
    isDragging = false;
    localPreview.classList.remove("dragging");
  };

  localPreview.addEventListener("pointerup", stopDragging);
  localPreview.addEventListener("pointercancel", stopDragging);
}

connectBtn.addEventListener("click", connectSignaling);
startCameraBtn.addEventListener("click", startCamera);
callBtn.addEventListener("click", makeCall);
hangupBtn.addEventListener("click", hangUp);

navLogout.addEventListener("click", () => {
  localStorage.removeItem("auth_token");
});

(async function initPage() {
  setupDraggableLocalPreview();
  setStatus(wsStatus, "Signaling: Waiting", "neutral");
  setStatus(cameraStatus, "Camera: Off", "neutral");
  setStatus(callStatus, "Call: Idle", "neutral");
  await loadCurrentUser();
  await loadFriends();
})();