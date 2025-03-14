import { NextRequest, NextResponse } from 'next/server'
import { kv } from "@vercel/kv"

export const config = {
  matcher: '/:path*',
}

async function sendTelegramMessage(message: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
      }),
    });

    if (!response.ok) {
      throw new Error(`Telegram API error: ${response.statusText}`);
    }
  } catch (error) {
    console.error('Failed to send Telegram message:', error);
  }
}

export async function middleware(req: NextRequest) {
  try {
    const path = req.nextUrl.pathname.replace('/', '')

    let endURL = await kv.get(path)

    if (path) {
      if (endURL) {
        // Send notification to Telegram
        const geo = req.geo || {};
        const locationMessage = `Shortlink accessed: ${req.nextUrl.origin}/${path}\nLocation: ${geo.city}, ${geo.region}, ${geo.country}`;
        await sendTelegramMessage(locationMessage);

        // if endURL missing http/https, add it
        if (!endURL.match(/^[a-zA-Z]+:\/\//)) {
          endURL = 'http://' + endURL
        }
        return NextResponse.redirect(new URL(endURL))

      } else {

        // Search for a secure key
        let allKeys = []
        for await (const key of kv.scanIterator()) {
          allKeys.push(key)
        }
        let secureKey = allKeys.find((key) => key.startsWith(path))
        if (secureKey) {
          return NextResponse.redirect(new URL(req.nextUrl.toString().replace('/' + path, '') + '/unlock?key=' + path.split('$')[0]))
        }
        else if (path.includes('$')) {
          return NextResponse.redirect(new URL(req.nextUrl.toString().replace('/' + path, '') + '/unlock?key=' + path.split('$')[0] ))
        }

        return NextResponse.next()
      }
    } else {
      return NextResponse.next()
    }
  } catch (error) {
    console.error('Middleware error:', error)
    return NextResponse.next()
  }
}