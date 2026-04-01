const $ = (id) => document.getElementById(id);

const authToken = localStorage.getItem("auth_token");
const friendsCountEl = $("friendsCount");
const friendsListEl = $("friendsList");
const noFriendsEl = $("noFriends");
const requestsListEl = $("friendRequestsList");
const noRequestsEl = $("noRequests");
const actionMessageEl = $("friendActionMessage");

const searchTargetEl = $("searchTarget");
const searchBtn = $("searchBtn");
const searchResultEl = $("searchResult");
const addFriendBtn = $("addFriendBtn");

let selectedCandidate = null;

const requestModal = $("requestModal");
const modalOverlay = $("modalOverlay");
const closeModalBtn = $("closeModalBtn");
const confirmBtn = $("confirmBtn");
const cancelBtn = $("cancelBtn");
const modalTextEl = $("modalText");

let selectedRequest = null;
let selectedAction = null;

if (!authToken) {
  window.location.href = "/ui/login/index.html";
}

function setActionMessage(msg, type = "success") {
  actionMessageEl.textContent = msg;
  actionMessageEl.className = "action-message " + type;
  setTimeout(() => {
    actionMessageEl.textContent = "";
    actionMessageEl.className = "action-message";
  }, 3500);
}

function openModal(action, name, requestId) {
  selectedAction = action;
  selectedRequest = requestId;
  modalTextEl.textContent =
    action === "accept"
      ? `Chấp nhận yêu cầu kết bạn của ${name}?`
      : `Từ chối yêu cầu kết bạn của ${name}?`;
  requestModal.classList.add("open");
  requestModal.setAttribute("aria-hidden", "false");
}

function closeModal() {
  requestModal.classList.remove("open");
  requestModal.setAttribute("aria-hidden", "true");
  selectedRequest = null;
  selectedAction = null;
}

function clearSearchResult() {
  searchResultEl.textContent = "";
  addFriendBtn.style.display = "none";
  selectedCandidate = null;
}

function setSearchResult(message, type = "info") {
  searchResultEl.textContent = message;
  searchResultEl.className = "search-result " + type;
}

async function searchUser() {
  const query = searchTargetEl.value.trim();
  if (!query) {
    setSearchResult("Vui lòng nhập username hoặc email", "error");
    clearSearchResult();
    return;
  }

  try {
    const res = await fetch(`/api/user/search?q=${encodeURIComponent(query)}`, {
      headers: { Authorization: "Bearer " + authToken },
    });

    if (res.status === 404) {
      setSearchResult("Không tìm thấy người dùng", "error");
      clearSearchResult();
      return;
    }

    if (!res.ok) {
      throw new Error("Lỗi tìm người dùng");
    }

    const data = await res.json();
    if (!data?.user || !data.user.id) {
      setSearchResult("Không tìm thấy người dùng", "error");
      clearSearchResult();
      return;
    }

    selectedCandidate = data.user;
    setSearchResult(`Tìm thấy: ${selectedCandidate.username} (${selectedCandidate.email})`, "success");
    addFriendBtn.style.display = "inline-block";
  } catch (err) {
    console.error(err);
    setSearchResult("Lỗi khi tìm người dùng", "error");
    clearSearchResult();
  }
}

async function sendFriendRequest(targetUserID) {
  const res = await fetch("/api/friend/request", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + authToken,
    },
    body: JSON.stringify({ to_user_id: targetUserID }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Không thể gửi yêu cầu kết bạn");
  }

  const body = await res.json();
  return body;
}

async function fetchFriends() {
  try {
    const res = await fetch("/api/friend/myfriends", {
      headers: { Authorization: "Bearer " + authToken },
    });

    if (res.status === 401 || res.status === 403) {
      return window.location.assign("/ui/login/index.html");
    }

    if (!res.ok) {
      throw new Error("Không thể tải danh sách bạn bè");
    }

    const data = await res.json();
    const friends = data?.friends || [];

    friendsListEl.innerHTML = "";
    if (friends.length === 0) {
      noFriendsEl.style.display = "block";
    } else {
      noFriendsEl.style.display = "none";
      friends.forEach((friend) => {
        const li = document.createElement("li");
        li.className = "friends-item";
        li.innerHTML = `
          <div>
            <strong>${friend.username}</strong>
            <div class="friend-meta">${friend.email}</div>
          </div>
        `;
        friendsListEl.appendChild(li);
      });
    }

    friendsCountEl.textContent = friends.length;
  } catch (err) {
    console.error(err);
    setActionMessage("Lỗi tải danh sách bạn bè", "error");
  }
}

async function fetchFriendRequests() {
  try {
    const res = await fetch("/api/friend/requests", {
      headers: { Authorization: "Bearer " + authToken },
    });

    // nếu không tồn tại endpoint, giữ mặc định "không có yêu cầu"
    if (res.status === 404) {
      noRequestsEl.style.display = "block";
      return;
    }

    if (!res.ok) {
      throw new Error("Không thể tải yêu cầu kết bạn");
    }

    const data = await res.json();
    const requests = data?.requests || [];

    requestsListEl.innerHTML = "";
    if (requests.length === 0) {
      noRequestsEl.style.display = "block";
      return;
    }

    noRequestsEl.style.display = "none";
    requests.forEach((req) => {
      const li = document.createElement("li");
      li.className = "request-item";
      li.innerHTML = `
        <div class="request-row">
          <span>${req.from_username || req.from_user_id || "Người dùng"}</span>
          <div class="request-actions">
            <button class="btn btn-small" data-action="accept" data-id="${req.id}" data-name="${req.from_username}">Chấp nhận</button>
            <button class="btn btn-small btn-secondary" data-action="refuse" data-id="${req.id}" data-name="${req.from_username}">Từ chối</button>
          </div>
        </div>
      `;
      requestsListEl.appendChild(li);
    });
  } catch (err) {
    console.error(err);
    noRequestsEl.style.display = "block";
  }
}

async function processFriendRequest(requestId, action) {
  const endpoint = action === "accept" ? "/api/friend/accept" : "/api/friend/refuse";
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + authToken,
    },
    body: JSON.stringify({ request_id: requestId }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || "Hành động thất bại");
  }

  const data = await res.json();
  return data;
}

confirmBtn.addEventListener("click", async () => {
  if (!selectedRequest || !selectedAction) {
    return closeModal();
  }

  try {
    await processFriendRequest(selectedRequest, selectedAction);
    setActionMessage(
      selectedAction === "accept"
        ? "Đã chấp nhận yêu cầu kết bạn"
        : "Đã từ chối yêu cầu kết bạn",
      "success"
    );
    await fetchFriends();
    await fetchFriendRequests();
  } catch (err) {
    console.error(err);
    setActionMessage(err.message || "Xử lý yêu cầu thất bại", "error");
  } finally {
    closeModal();
  }
});

cancelBtn.addEventListener("click", closeModal);
closeModalBtn.addEventListener("click", closeModal);
modalOverlay.addEventListener("click", closeModal);

requestsListEl.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }

  const action = button.dataset.action;
  const id = button.dataset.id;
  const name = button.dataset.name || "Người dùng";

  if (!id || !action) {
    return;
  }

  openModal(action, name, id);
});

searchBtn.addEventListener("click", searchUser);
searchTargetEl.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    searchUser();
  }
});

addFriendBtn.addEventListener("click", async () => {
  if (!selectedCandidate || !selectedCandidate.id) {
    setSearchResult("Vui lòng tìm người dùng, sau đó nhấn Thêm bạn", "error");
    return;
  }

  try {
    await sendFriendRequest(selectedCandidate.id);
    setActionMessage("Đã gửi yêu cầu kết bạn", "success");
    clearSearchResult();
    searchTargetEl.value = "";
    await fetchFriendRequests();
  } catch (err) {
    console.error(err);
    setActionMessage(err.message || "Không thể gửi yêu cầu", "error");
  }
});

loadPage();

async function loadPage() {
  await fetchFriends();
  await fetchFriendRequests();
}

