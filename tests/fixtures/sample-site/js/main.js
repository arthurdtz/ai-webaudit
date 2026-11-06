// Saudação a partir do fragmento da URL (#Nome)
var saudacao = document.getElementById('saudacao');
if (saudacao && location.hash) {
  saudacao.innerHTML = 'Olá, ' + decodeURIComponent(location.hash.slice(1)) + '!';
}

// Envio do formulário de contato
var form = document.getElementById('contato');
if (form) {
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var dados = {
      nome: form.nome.value,
      email: form.email.value,
      telefone: form.telefone.value,
      mensagem: form.mensagem.value
    };
    gtag('event', 'generate_lead', { email: dados.email, telefone: dados.telefone });
    fetch('http://localhost:3000/api/contato', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados)
    }).then(function () { form.reset(); });
  });
}
