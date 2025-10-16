const fs = require('fs')
const path = require('path')
const PAYMENT_DIR = path.join(__dirname, '../payment')

module.exports = {
  hears: [
    {
      trigger: '➕',
      action: async (ctx) => {
        // CEK PAYMENT DI SINI!
        const paymentFile = path.join(PAYMENT_DIR, `${ctx.from.id}.json`)
        if (fs.existsSync(paymentFile)) {
          return ctx.reply('Kamu masih punya transaksi yang belum selesai. Selesaikan atau batalkan dulu ya!')
        }

        if (!ctx.session.cart) return ctx.reply('Belum ada provider dipilih.')
        if (ctx.session.cart.jumlah < ctx.session.cart.stok) {
          ctx.session.cart.jumlah += 1
        }
        // Edit pesan keranjang
        const msg = generateCartMessage(ctx.session.cart)
        await editCartMessage(ctx, msg)
      }
    },
    {
      trigger: '➖',
      action: async (ctx) => {
        // CEK PAYMENT DI SINI JUGA!
        const paymentFile = path.join(PAYMENT_DIR, `${ctx.from.id}.json`)
        if (fs.existsSync(paymentFile)) {
          return ctx.reply('Kamu masih punya transaksi yang belum selesai. Selesaikan atau batalkan dulu ya!')
        }

        if (!ctx.session.cart) return ctx.reply('Belum ada provider dipilih.')
        if (ctx.session.cart.jumlah > 0) {
          ctx.session.cart.jumlah -= 1
        }
        // Edit pesan keranjang
        const msg = generateCartMessage(ctx.session.cart)
        await editCartMessage(ctx, msg)
      }
    },
    {
      trigger: 'Beli',
      action: async (ctx) => {
        // CEK PAYMENT DI SINI JUGA!
        const paymentFile = path.join(PAYMENT_DIR, `${ctx.from.id}.json`)
        if (fs.existsSync(paymentFile)) {
          return ctx.reply('Kamu masih punya transaksi yang belum selesai. Selesaikan atau batalkan dulu ya!')
        }

        if (!ctx.session.cart || ctx.session.cart.jumlah < 1) {
          return ctx.reply('Jumlah pembelian harus minimal 1!')
        }
        // Generate link pembayaran
        const user = ctx.from
        const total = ctx.session.cart.harga * ctx.session.cart.jumlah
        const url = `${process.env.API_SAWERIA}?amount=${total}&message=${encodeURIComponent(ctx.session.cart.nama_provider)}%20|%20${ctx.session.cart.jumlah}&payment_type=qris&first_name=${user.id}&email=${user.id}_${ctx.session.id_toko}@gmail.com`

        ctx.reply(`Klik link berikut untuk bayar via QRIS:\n${url}`)
      }
    }
  ]
}

// Helper buat edit pesan
async function editCartMessage(ctx, text) {
  try {
    if (ctx.session.cart_message_id) {
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        ctx.session.cart_message_id,
        undefined,
        text,
        {
          parse_mode: 'HTML',
          reply_markup: {
            keyboard: [['➖', `${ctx.session.cart.jumlah}`, '➕'], ['Batal', 'Beli']],
            resize_keyboard: true
          }
        }
      )
    } else {
      await ctx.reply(text, {
        parse_mode: 'HTML',
        reply_markup: {
          keyboard: [['➖', `${ctx.session.cart.jumlah}`, '➕'], ['Batal', 'Beli']],
          resize_keyboard: true
        }
      })
    }
  } catch (e) {
    await ctx.reply(text, {
      parse_mode: 'HTML',
      reply_markup: {
        keyboard: [['➖', `${ctx.session.cart.jumlah}`, '➕'], ['Batal', 'Beli']],
        resize_keyboard: true
      }
    })
  }
}

// Helper buat generate pesan keranjang
function generateCartMessage(cart) {
  const subtotal = cart.harga * cart.jumlah
  let msg = `Berikut stok dari <b>${cart.nama_provider}</b> | <b>${cart.nama_kategori}</b>\n\n`
  msg += `Stok tersisa: <b>${cart.stok}</b>\nHarga: <b>Rp ${cart.harga.toLocaleString()}</b>\n\n`
  msg += `Kamu membeli\nQTY : <b>${cart.jumlah}</b>\nHarga : <b>Rp ${subtotal.toLocaleString()}</b>\n`
  msg += `\nSilakan pilih jumlah:`
  return msg
}
