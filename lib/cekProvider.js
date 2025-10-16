const axios = require('axios')
const fs = require('fs')
const path = require('path')
const PAYMENT_DIR = path.join(__dirname, '../payment')

module.exports = {
  hears: {
    trigger: /^[0-9]+$/, // User pencet angka (provider_id)
    action: async (ctx) => {
      // Cek payment pending
      const paymentFile = path.join(PAYMENT_DIR, `${ctx.from.id}.json`)
      if (fs.existsSync(paymentFile)) {
        return ctx.reply('Kamu masih punya transaksi yang belum selesai. Selesaikan atau batalkan dulu ya!')
      }

      const provider_id = ctx.message.text.trim()
      const toko_id = ctx.session.id_toko || process.env.ID_TOKO
      const url = `${process.env.API_CEKSTOK}?user_id=${ctx.from.id}&toko_id=${toko_id}&provider_id=${provider_id}`

      try {
        const res = await axios.get(url)
        const data = res.data

        // === CASE: PROVIDER TIDAK AKTIF / TIDAK ADA ===
        if (!data.success) {
          let msg = data.message || 'Provider tidak ditemukan atau tidak aktif!'
          if (data.error_code === 'PROVIDER_NOT_FOUND') {
            msg = 'Provider tidak ditemukan atau sudah dinonaktifkan. Pilih provider lain ya!'
          }
          return ctx.reply(msg)
        }

        // === CASE: PROVIDER ADA, CEK STOK ===
        const stok = parseInt(data.total_stok || data.stok || 0)
        const harga = parseInt(data.harga || 0)
        const nama_provider = data.nama_provider || '-'
        const deskripsi = data.deskripsi || ''
        ctx.session.cart = {
          provider_id,
          nama_provider,
          kategori_id: data.kategori_id || null,
          nama_kategori: data.nama_kategori || null,
          jumlah: 0,
          stok,
          harga
        }
        ctx.session.cart_message_id = null // reset message id

        // === Pesan awal ===
        let msg = `Berikut stok dari <b>${nama_provider}</b>\n`
        if (deskripsi) msg += `<i>${deskripsi}</i>\n\n`
        else msg += `\n`
        msg += `Stok tersisa: <b>${stok}</b>\nHarga: <b>Rp ${harga.toLocaleString()}</b>\n\n`
        msg += `Kamu membeli\nQTY : <b>0</b>\nHarga : <b>Rp 0</b>\n`
        msg += `\nSilakan pilih jumlah:`

        // === CASE: STOK HABIS ===
        let keyboard = [['Batal']]
        if (stok > 0) {
          keyboard = [['➖', '0', '➕'], ['Batal', 'Beli']]
        } else {
          msg += `\n⚠️ Maaf, stok sedang kosong!`
        }

        const reply = await ctx.reply(msg, {
          parse_mode: 'HTML',
          reply_markup: {
            keyboard,
            resize_keyboard: true
          }
        })
        ctx.session.cart_message_id = reply.message_id
      } catch (e) {
        ctx.reply('Gagal cek provider. Coba lagi nanti.')
      }
    }
  }
}
