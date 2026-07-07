import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import Swal from 'sweetalert2'

// 覆寫全域的 alert，將原生的 alert(會顯示網址) 替換為 SweetAlert2 的美觀錯誤視窗
window.alert = (msg) => {
  Swal.fire({
    title: '提示',
    text: msg,
    icon: 'warning',
    confirmButtonColor: '#F3B32A',
    background: '#1E1E1E',
    color: '#fff'
  });
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
