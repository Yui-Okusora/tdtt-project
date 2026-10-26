document.addEventListener('DOMContentLoaded', () => {

  const loginForm = document.getElementById('loginForm');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');

  loginForm.addEventListener('submit', (event) => {
    
    event.preventDefault();

    const usernameValue = usernameInput.value.trim();
    const passwordValue = passwordInput.value.trim();


    // kiem tra o dang nhap co bi bo trong hay khong
    if (usernameValue === '') {
      alert('Vui lòng nhập tên đăng nhập!');
      usernameInput.focus(); // dua con tro ve o nhap ten
      return; 
    }

    // kiem tra o mat khau co bi bo trong hay khong
    if (passwordValue === '') {
      alert('Vui lòng nhập mật khẩu!');
      passwordInput.focus(); // dua con tro ve o nhap mat khau
      return;
    }

    // kiem tra do dai cua mat khau
    if (passwordValue.length < 6) {
      alert('Mật khẩu phải chứa ít nhất 6 ký tự!');
      passwordInput.focus();
      return;
    }


    // thong bao da dang nhap thanh cong
    alert('Đăng nhập thành công! Đang chuyển sang trang trắng...');

    // luu ten nguoi dung vao bo nho
    localStorage.setItem('loggedInUser', usernameValue);

    // chuyen huong sang trang trang
    window.location.href = '../trangchu/blank.html';
  });

});