const axios = require('axios')
const fs = require('fs')
const path = require('path')
const qrcode = require('qrcode')

const PAYMENT_DIR = path.join(__dirname, '../payment')
if (!fs.existsSync(PAYMENT_DIR)) fs.mkdirSync(PAYMENT_DIR)

module.exports = {
  hears: {
    trigger: 'Beli',
    action: async (ctx) => {
      const paymentFile = path.join(PAYMENT_DIR, `${ctx.from.id}.json`)
      if (fs.existsSync(paymentFile)) {
        return ctx.reply('Kamu masih punya transaksi yang belum selesai. Selesaikan atau batalkan dulu ya!')
      }
      const cart = ctx.session.cart
      if (!cart || cart.jumlah < 1) return ctx.reply('Belum ada item di keranjang.')

      // API pembayaran
      const user = ctx.from
      const total = cart.harga * cart.jumlah
      const url = `${process.env.API_SAWERIA}?amount=${total}&message=${encodeURIComponent(cart.nama_provider)}%20|%20${cart.jumlah}&payment_type=qris&first_name=${user.id}&email=${user.id}_${ctx.session.id_toko}@gmail.com`
      try {
        const res = await axios.get(url)
        if (!res.data || !res.data.data || !res.data.data.qr_string) {
          return ctx.reply('Gagal membuat transaksi pembayaran!')
        }
        const qrPath = path.join(PAYMENT_DIR, `${ctx.from.id}_qr.png`)
        await qrcode.toFile(qrPath, res.data.data.qr_string)

        // Simpan payment
        const paymentData = {
          ...res.data.data,
          expired: Date.now() + 5 * 60 * 1000,
          provider_id: ctx.session.cart.provider_id,
          kategori_id: ctx.session.cart.kategori_id,
          qty: ctx.session.cart.jumlah,
          total_nominal: ctx.session.cart.harga * ctx.session.cart.jumlah,
          toko_id: ctx.session.id_toko,
          message: `${ctx.session.cart.nama_provider} | ${ctx.session.cart.jumlah}`
        }
        fs.writeFileSync(paymentFile, JSON.stringify(paymentData, null, 2))


        // Kirim QRIS
        await ctx.replyWithPhoto({ source: qrPath },
          {
            caption: `Silakan scan QRIS berikut untuk membayar.\n\nStatus: <b>${res.data.data.status}</b>\nJika sudah membayar, klik <b>Konfirmasi Pembayaran</b>.`,
            parse_mode: 'HTML',
            reply_markup: {
              keyboard: [['Konfirmasi Pembayaran', 'Batal']],
              resize_keyboard: true
            }
          }
        )
        fs.unlinkSync(qrPath)
      } catch (e) {
        ctx.reply('Terjadi kesalahan saat membuat pembayaran.')
      }
    }
  }
}
