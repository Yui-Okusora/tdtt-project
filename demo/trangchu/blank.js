document.addEventListener('DOMContentLoaded', () => {
  // Lay ten nguoi dung da luu
  const savedUser = localStorage.getItem('loggedInUser') || 'Khách';

  // hien thi loi chao
  document.getElementById('welcomeTitle').innerText = 'Xin chào, ' + savedUser + '!';

  // xu ly khi bam nut dang xuat
  const btnLogout = document.getElementById('btnLogout');
  btnLogout.addEventListener('click', () => {
    // xoa ten nguoi dung
    localStorage.removeItem('loggedInUser');

    // Quay lai trang dang nhap
    window.location.href = 'login.html';
  });
});