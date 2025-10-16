// Untuk logic session custom (optional)
module.exports = {
  getSession: (ctx) => ctx.session,
  setSession: (ctx, key, value) => { ctx.session[key] = value }
}
