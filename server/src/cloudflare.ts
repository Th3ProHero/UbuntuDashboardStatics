// Using native fetch in Node 18+

const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;

export async function getCloudflareTunnels() {
  if (!CF_API_TOKEN || !CF_ACCOUNT_ID) {
    throw new Error('Cloudflare API Token or Account ID not configured');
  }

  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/cfd_tunnel`, {
    headers: {
      'Authorization': `Bearer ${CF_API_TOKEN}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Cloudflare API Error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.result || [];
}

export async function getCloudflareZones() {
  if (!CF_API_TOKEN) {
    throw new Error('Cloudflare API Token not configured');
  }

  const response = await fetch(`https://api.cloudflare.com/client/v4/zones`, {
    headers: {
      'Authorization': `Bearer ${CF_API_TOKEN}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Cloudflare API Error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.result || [];
}

export async function getCloudflareDnsRecords(zoneId: string) {
  if (!CF_API_TOKEN) {
    throw new Error('Cloudflare API Token not configured');
  }

  const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`, {
    headers: {
      'Authorization': `Bearer ${CF_API_TOKEN}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Cloudflare API Error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.result || [];
}
