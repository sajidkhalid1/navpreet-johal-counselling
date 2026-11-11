document.querySelectorAll('dialog .close').forEach(button=>button.addEventListener('click',()=>button.closest('dialog').close()));
const privacy=document.querySelector('#privacy-open');privacy?.addEventListener('click',()=>document.querySelector('#privacy-dialog').showModal());
const year=document.querySelector('#year');if(year)year.textContent=new Date().getFullYear();
