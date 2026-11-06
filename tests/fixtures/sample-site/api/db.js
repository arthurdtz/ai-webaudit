// Stub do acesso ao banco (fixture): não executa nada.
module.exports = { query: async function (sql) { return { sql: sql }; } };
