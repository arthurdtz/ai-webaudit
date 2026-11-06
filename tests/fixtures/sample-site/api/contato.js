const db = require('./db');
const leads = [];

module.exports = async (req, res) => {
  const origin = req.headers.origin;
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'GET') {
    return res.status(200).json(leads);
  }
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  const { nome, email, telefone, mensagem } = req.body;
  await db.query(
    "INSERT INTO leads (nome, email, telefone, mensagem) VALUES ('" +
      nome + "', '" + email + "', '" + telefone + "', '" + mensagem + "')"
  );
  leads.push({ nome, email, telefone, mensagem });

  await fetch('https://api.email-exemplo.test/send', {
    method: 'POST',
    body: JSON.stringify({ to: process.env.CONTACT_TO, subject: 'Novo contato', text: mensagem })
  });

  return res.status(200).json({ ok: true });
};
