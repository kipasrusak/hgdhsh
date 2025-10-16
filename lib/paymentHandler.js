const axios = require('axios')
const fs = require('fs')
const path = require('path')
const qrcode = require('qrcode')
const PAYMENT_DIR = path.join(__dirname, '../payment')

module.exports = {
  hears: [
    {
      trigger: 'Konfirmasi Pembayaran',
      action: async (ctx) => {
        const paymentFile = path.join(PAYMENT_DIR, `${ctx.from.id}.json`)
        if (!fs.existsSync(paymentFile)) {
          return ctx.reply('Tidak ada transaksi yang perlu dikonfirmasi.')
        }

        const paymentData = JSON.parse(fs.readFileSync(paymentFile))
        const transaksiId = paymentData.id
        const message = paymentData.message
        const provider_id = paymentData.provider_id
        const kategori_id = paymentData.kategori_id
        const toko_id = paymentData.toko_id
        const qty = paymentData.qty || 1

        // Cek status pembayaran ke API
        const urlStatus = `http://localhost/projek/stok/datakuu/saweria-status.php?id=${transaksiId}`

        try {
          const res = await axios.get(urlStatus)
          const statusData = res.data?.data || {}
          let status = ''
          if (typeof statusData.qr_string === 'string') {
            status = statusData.qr_string === '' ? 'SUCCESS' : 'PENDING'
          } else {
            status = 'PENDING'
          }

          let caption = `Status: <b>${status}</b>\nPesanan: <b>${message}</b>\nID Transaksi: <code>${transaksiId}</code>\n`

          // === Jika status masih PENDING, kirim QRIS ulang + info ===
          if (status === 'PENDING') {
            if (statusData.qr_string) {
              const qrPath = path.join(PAYMENT_DIR, `${ctx.from.id}_qr.png`)
              await qrcode.toFile(qrPath, statusData.qr_string)
              await ctx.replyWithPhoto({ source: qrPath }, {
                caption: `${caption}\nSilakan scan QRIS berikut untuk membayar. Jika sudah bayar, klik konfirmasi lagi.`,
                parse_mode: 'HTML',
                reply_markup: {
                  keyboard: [['Konfirmasi Pembayaran', 'Batal']],
                  resize_keyboard: true
                }
              })
              fs.unlinkSync(qrPath)
            } else {
              return ctx.reply(`${caption}\nPembayaran kamu masih <b>PENDING</b>. QRIS tidak tersedia.`, {
                parse_mode: 'HTML',
                reply_markup: {
                  keyboard: [['Konfirmasi Pembayaran', 'Kirim Ulang QRIS', 'Batal']],
                  resize_keyboard: true
                }
              })
            }
            return
          }

          // === Jika sukses, ambil voucher sebanyak qty ===
 if (status === 'SUCCESS') {
  let vouchCount = qty
  let voucherList = []
  let gagalCount = 0
  let lastErrorMsg = ''
  for (let i = 0; i < vouchCount; i++) {
    const urlVoucher = `https://algaza.site/projek/stok/datakuu/ambilvoucher.php?user_id=${ctx.from.id}&toko_id=${toko_id}&provider_id=${provider_id}`
    try {
      // LOG endpoint GET yang dipanggil
      console.log(`[${new Date().toISOString()}] GET ${urlVoucher}`)
      const vRes = await axios.get(urlVoucher)
      // LOG response
      console.log(`[${new Date().toISOString()}] Response:`, JSON.stringify(vRes.data))
      if (vRes.data && vRes.data.success && vRes.data.data) {
        const data = vRes.data.data
        voucherList.push(`🎟️ <b>${data.nama_voucher}</b>\nKode: <a href="${data.kode}">${data.kode}</a>`)
      } else {
        gagalCount++
        lastErrorMsg = vRes.data?.message || lastErrorMsg
        console.error(`[${new Date().toISOString()}] ERROR ambil voucher #${i + 1}: ${lastErrorMsg}`)
      }
    } catch (e) {
      gagalCount++
      lastErrorMsg = e.message || lastErrorMsg
      // LOG error + stack trace
      console.error(`[${new Date().toISOString()}] EXCEPTION ambil voucher #${i + 1}: ${e.message}\n${e.stack}`)
    }
  }

  fs.unlinkSync(paymentFile)
  ctx.session.cart = null

  let msgVoucher = `<b>Voucher kamu:</b>\n\n`
  if (voucherList.length) {
    msgVoucher += voucherList.join('\n\n')
  } else {
    msgVoucher += `Gagal mengambil voucher: <b>${lastErrorMsg || 'Voucher stok habis atau tidak ditemukan.'}</b>\nHubungi admin untuk bantuan/refund.`
  }

  if (gagalCount > 0) {
    msgVoucher += `\n\n⚠️ Hanya ${voucherList.length} dari ${qty} voucher yang bisa diambil.`
    msgVoucher += `\nHubungi admin untuk refund.`
  }

  return ctx.reply(
    caption + '\n' + msgVoucher,
    {
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_markup: { keyboard: [['/start']], resize_keyboard: true }
    }
  )
}


          // GAGAL/EXPIRED
          fs.unlinkSync(paymentFile)
          ctx.session.cart = null
          return ctx.reply(`${caption}\nPembayaran <b>GAGAL/EXPIRED</b>. Silakan ulangi pemesanan dari awal.`, {
            parse_mode: 'HTML',
            reply_markup: { keyboard: [['/start']], resize_keyboard: true }
          })
        } catch (e) {
          ctx.reply('Gagal cek status pembayaran. Silakan coba lagi sebentar lagi.')
        }
      }
    },
    // Handler Kirim Ulang QRIS & Batal tetap sama seperti sebelumnya
  ]
}
