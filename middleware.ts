import { NextRequest, NextResponse } from 'next/server'
import storage from './utils/storage'

export const config = {
  matcher: '/:path*',
}

// Debug function to print request details
function logRequest(req: NextRequest) {
  console.log(`
Request:
  - Method: ${req.method}
  - URL: ${req.url}
  - Path: ${req.nextUrl.pathname}
  - Host: ${req.nextUrl.host}
  - Origin: ${req.nextUrl.origin}
  - Headers: ${JSON.stringify(Array.from(req.headers.entries()))}
  `);
}

async function sendTelegramMessage(message: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  
  if (!botToken || !chatId) {
    console.warn('Telegram bot token or chat ID not set');
    return;
  }
  
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
    logRequest(req);
    const path = req.nextUrl.pathname.replace('/', '')
    console.log(`Processing path: ${path}`);

    if (!path || path.includes('/api/') || path === 'favicon.ico') {
      return NextResponse.next();
    }

    // Debug: Dump memory store to see if URLs are stored
    await storage.dumpMemoryStore();
    
    // Debug: List all keys in storage
    const allKeys = await storage.keys();
    console.log(`All keys in storage (${allKeys.length}): ${allKeys.join(', ')}`);

    let endURL = await storage.get(path);
    console.log(`Lookup result for ${path}: ${endURL}`);

    if (endURL) {
      // Send notification to Telegram
      const geo = req.geo || {};
      const locationMessage = `Shortlink accessed: ${req.nextUrl.origin}/${path}\nLocation: ${geo.city || 'Unknown'}, ${geo.region || 'Unknown'}, ${geo.country || 'Unknown'}`;
      await sendTelegramMessage(locationMessage);

      // if endURL missing http/https, add it
      if (!endURL.match(/^[a-zA-Z]+:\/\//)) {
        endURL = 'http://' + endURL;
      }
      
      console.log(`Redirecting to: ${endURL}`);
      return NextResponse.redirect(new URL(endURL));
    } else {
      // Check for secure keys with password
      const secureKey = allKeys.find(key => key.startsWith(path) && key.includes('$'));
      
      if (secureKey) {
        console.log(`Found secure key: ${secureKey}`);
        return NextResponse.redirect(new URL(`${req.nextUrl.origin}/unlock?key=${path.split('$')[0]}`));
      } else if (path.includes('$')) {
        console.log(`Path contains $: ${path}`);
        return NextResponse.redirect(new URL(`${req.nextUrl.origin}/unlock?key=${path.split('$')[0]}`));
      }

      console.log(`No URL found for ${path}, continuing to next middleware`);
      return NextResponse.next();
    }
  } catch (error) {
    console.error('Middleware error:', error);
    return NextResponse.next();
  }
}