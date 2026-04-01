const messageEl = document.getElementById("message");
const registerForm = document.getElementById("register-form");
const registerBtn = document.getElementById("registerBtn");

function showMessage(text, type = "error") {
  messageEl.textContent = text;
  messageEl.className = `message ${type}`;
}

function clearMessage() {
  messageEl.textContent = "";
  messageEl.className = "message";
}

registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearMessage();

  const username = document.getElementById("username").value.trim();
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();

  if (!username || !email || !password) {
    showMessage("Vui lòng điền đủ thông tin", "error");
    return;
  }

  registerBtn.disabled = true;
  registerBtn.textContent = "Đang gửi...";

  try {
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, email, password }),
    });

    const body = await res.json().catch(() => ({}));

    if (!res.ok) {
      showMessage(body.error || "Đăng ký thất bại", "error");
      return;
    }

    showMessage("Đăng ký thành công. Chuyển đến trang đăng nhập...", "success");
    setTimeout(() => {
      window.location.href = "/ui/login/index.html";
    }, 1000);
  } catch (err) {
    showMessage(`Lỗi kết nối: ${err.message}`, "error");
  } finally {
    registerBtn.disabled = false;
    registerBtn.textContent = "Đăng ký";
  }
});
