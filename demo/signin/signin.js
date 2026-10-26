document.addEventListener('DOMContentLoaded', () => {

  const signinForm = document.getElementById('signinForm');
  const fullnameInput = document.getElementById('fullname');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const confirmPasswordInput = document.getElementById('confirmPassword');

  signinForm.addEventListener('submit', (event) => {
    event.preventDefault(); // Chan tai lại trang

    const fullnameValue = fullnameInput.value.trim();
    const emailValue = emailInput.value.trim();
    const passwordValue = passwordInput.value.trim();
    const confirmPasswordValue = confirmPasswordInput.value.trim();

    // kiem tra ten dang nhap
    if (fullnameValue === '') {
      alert('Vui lòng nhập tên đăng nhập!');
      fullnameInput.focus();
      return;
    }

    // kiem tra email
    if (emailValue === '') {
      alert('Vui lòng nhập email!');
      emailInput.focus();
      return;
    }

    // kiem tra mat khau
    if (passwordValue === '') {
      alert('Vui lòng tạo mật khẩu!');
      passwordInput.focus();
      return;
    }

    if (passwordValue.length < 6) {
      alert('Mật khẩu phải chứa ít nhất 6 ký tự!');
      passwordInput.focus();
      return;
    }

    // kiem tra xac nhan mat khau
    if (confirmPasswordValue === '') {
      alert('Vui lòng nhập lại mật khẩu xác nhận!');
      confirmPasswordInput.focus();
      return;
    }

    if (confirmPasswordValue !== passwordValue) {
      alert('Mật khẩu xác nhận không trùng khớp!');
      confirmPasswordInput.focus();
      return;
    }

    // dang ky thanh cong
    alert('Đăng ký tài khoản thành công! Vui lòng đăng nhập.');

    // dua ve trang dang nhap de dang nhap
    window.location.href = '../login/login.html';
  });

});