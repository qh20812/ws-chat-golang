const $ = (id) => document.getElementById(id);

const loginForm = $("login-form");
const emailInput = $("email");
const passwordInput = $("password");
const togglePasswordBtn = $("togglePassword");
const messageContainer = $("message");
const loginBtn = $("loginBtn");

const apiEndpoint = "/api/login";

function showMessage(text, type = "error") {
  messageContainer.textContent = text;
  messageContainer.classList.remove("error", "success");
  messageContainer.classList.add(type);
}

function clearMessage() {
  messageContainer.textContent = "";
  messageContainer.classList.remove("error", "success");
}

togglePasswordBtn.addEventListener("click", () => {
  const type = passwordInput.type === "password" ? "text" : "password";
  passwordInput.type = type;
  togglePasswordBtn.textContent = type === "password" ? "Hiện" : "Ẩn";
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  if (!email || !password) {
    showMessage("Vui lòng nhập đầy đủ email và mật khẩu", "error");
    return;
  }

  loginBtn.disabled = true;
  showMessage("Đang đăng nhập...", "success");

  try {
    const res = await fetch(apiEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const errorMsg = body?.error || "Đăng nhập thất bại. Vui lòng thử lại.";
      showMessage(errorMsg, "error");
      return;
    }

    const data = await res.json();
    if (!data?.token) {
      showMessage("Lỗi phản hồi từ máy chủ: thiếu token", "error");
      return;
    }

    localStorage.setItem("auth_token", data.token);
    showMessage("Đăng nhập thành công! Chuyển hướng...", "success");

    setTimeout(() => {
      window.location.href = "/ui/index.html";
    }, 600);
  } catch (error) {
    showMessage(
      "Lỗi mạng: " + (error?.message || "Không thể kết nối. "),
      "error",
    );
    console.error("Login error", error);
  } finally {
    loginBtn.disabled = false;
  }
});

window.addEventListener("keydown", (event) => {
  if (
    event.key === "Enter" &&
    document.activeElement &&
    event.target.tagName !== "TEXTAREA"
  ) {
    const form = document.activeElement.closest("form");
    if (form && form.id === "login-form") {
      event.preventDefault();
      loginForm.dispatchEvent(
        new Event("submit", { cancelable: true, bubbles: true }),
      );
    }
  }
});
