module.exports = {
  command: 'ganti_toko',
  handler: (ctx) => {
    const params = ctx.message.text.split(' ')
    if (params.length < 2) {
      return ctx.reply('Cara pakai: /ganti_toko [id_toko]')
    }
    ctx.session.id_toko = params[1]
    ctx.reply(`ID Toko diganti ke: ${params[1]}\nSilakan /start untuk refresh kategori.`)
  }
}
