const $ = (id) => document.getElementById(id);

const authToken = localStorage.getItem("auth_token");
const usernameEl = $("username");
const emailEl = $("email");
const joinedEl = $("joined");

const editBtn = $("editProfileBtn");
const friendsBtn = $("friendsListBtn");
const logoutBtn = $("logoutBtn");

const editModal = $("editModal");
const modalOverlay = $("modalOverlay");
const closeModalBtn = $("closeModalBtn");
const cancelProfileBtn = $("cancelProfileBtn");
const saveProfileBtn = $("saveProfileBtn");
const modalMessage = $("modalMessage");

const editProfileForm = $("editProfileForm");
const editUsernameInput = $("editUsername");
const editEmailInput = $("editEmail");
const editPasswordInput = $("editPassword");

if (!authToken) {
  window.location.href = "/ui/login/index.html";
}

function openModal() {
  clearModalMessage();
  editModal.classList.add("open");
  editModal.setAttribute("aria-hidden", "false");
}

function closeModal() {
  editModal.classList.remove("open");
  editModal.setAttribute("aria-hidden", "true");
}

function showModalMessage(text, type = "error") {
  modalMessage.textContent = text;
  modalMessage.classList.remove("error", "success");
  modalMessage.classList.add(type);
}

function clearModalMessage() {
  modalMessage.textContent = "";
  modalMessage.classList.remove("error", "success");
}

async function loadProfile() {
  try {
    const res = await fetch("/api/myprofile", {
      method: "GET",
      headers: {
        Authorization: "Bearer " + authToken,
      },
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        return window.location.assign("/ui/login/index.html");
      }
      throw new Error("Không thể tải thông tin người dùng.");
    }

    const data = await res.json();
    const username = data.username || "---";
    const email = data.email || "---";
    const createdAt = data.created_at
      ? new Date(data.created_at).toLocaleDateString()
      : "---";

    usernameEl.textContent = username;
    emailEl.innerHTML = `<strong>Email:</strong> ${email}`;
    joinedEl.innerHTML = `<strong>Ngày tạo:</strong> ${createdAt}`;

    editUsernameInput.value = username;
    editEmailInput.value = email;
    editPasswordInput.value = "";
  } catch (error) {
    console.error("Lỗi fetchProfile", error);
    usernameEl.textContent = "Không thể tải dữ liệu";
  }
}

async function updateProfile(payload) {
  const res = await fetch("/api/user", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + authToken,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const error = body?.error || "Cập nhật thất bại";
    throw new Error(error);
  }

  return res.json();
}

editBtn.addEventListener("click", () => openModal());
modalOverlay.addEventListener("click", closeModal);
closeModalBtn.addEventListener("click", closeModal);
cancelProfileBtn.addEventListener("click", closeModal);

logoutBtn.addEventListener("click", () => {
  localStorage.removeItem("auth_token");
  window.location.href = "/ui/login/index.html";
});

friendsBtn.addEventListener("click", () => {
  window.location.href = "/ui/list-friends/index.html";
});

editProfileForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearModalMessage();

  const username = editUsernameInput.value.trim();
  const email = editEmailInput.value.trim();
  const password = editPasswordInput.value.trim();

  if (!username || !email) {
    showModalMessage("Vui lòng nhập tên và email", "error");
    return;
  }

  saveProfileBtn.disabled = true;
  saveProfileBtn.textContent = "Đang lưu...";

  try {
    const payload = { username, email };
    if (password) {
      payload.password = password;
    }

    await updateProfile(payload);
    showModalMessage("Cập nhật thành công", "success");
    await loadProfile();
    setTimeout(closeModal, 700);
  } catch (error) {
    showModalMessage(error.message || "Cập nhật thất bại", "error");
  } finally {
    saveProfileBtn.disabled = false;
    saveProfileBtn.textContent = "Lưu thay đổi";
  }
});

loadProfile();
