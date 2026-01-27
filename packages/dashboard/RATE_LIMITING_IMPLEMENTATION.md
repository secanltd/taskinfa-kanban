# Cloudflare Rate Limiting Implementation Plan

**Status:** Planned
**Priority:** Critical
**Target Date:** February 2026

## Problem Statement

The current in-memory rate limiting implementation in `src/lib/middleware/rateLimit.ts` does not work in Cloudflare Workers because Workers are stateless and ephemeral. Each request may be handled by a different Worker instance, making in-memory state unreliable.

**Affected Endpoints:**
- `/api/auth/login` - Currently DISABLED (lines 11-16)
- `/api/auth/signup` - Currently DISABLED (lines 11-17)
- `/api/keys` - Has rate limiting but may be unreliable

## Solution Options

### Option 1: Cloudflare Rate Limiting API (Recommended)

**Pros:**
- Native Cloudflare feature, highly reliable
- No code changes needed in Workers
- Configured via Cloudflare dashboard or API
- Supports various rate limiting strategies (IP-based, header-based, etc.)
- Automatic protection against DDoS

**Cons:**
- Requires Enterprise or Business plan for advanced features
- Free tier has limited rate limiting capabilities
- Configuration is external to codebase

**Implementation Steps:**

1. **Configure Rate Limiting Rules via Dashboard:**
   - Go to Cloudflare Dashboard → Security → WAF → Rate Limiting Rules
   - Create rule for `/api/auth/login`:
     - Match: `http.request.uri.path eq "/api/auth/login"`
     - Action: Challenge or Block
     - Rate: 5 requests per minute per IP
   - Create rule for `/api/auth/signup`:
     - Match: `http.request.uri.path eq "/api/auth/signup"`
     - Action: Challenge or Block
     - Rate: 3 requests per 5 minutes per IP

2. **Or Configure via Wrangler:**
   ```toml
   # wrangler.toml
   [[unsafe.bindings]]
   name = "RATE_LIMITER"
   type = "ratelimit"
   namespace_id = "your_namespace_id"

   # Simple rate limiting: 10 requests per minute
   simple = { limit = 10, period = 60 }
   ```

3. **Test Rate Limiting:**
   ```bash
   # Test login endpoint
   for i in {1..10}; do curl -X POST https://taskinfa-kanban.secan-ltd.workers.dev/api/auth/login; done
   ```

4. **Remove TODO Comments:**
   - Remove disabled rate limiting code from `login/route.ts` and `signup/route.ts`
   - Add comments explaining that rate limiting is handled at Cloudflare level

### Option 2: Durable Objects (Code-Based Solution)

**Pros:**
- Full control over rate limiting logic
- Can implement complex rate limiting strategies
- State is persistent and consistent
- Free tier supports Durable Objects (with limits)

**Cons:**
- Requires significant code changes
- Additional complexity in codebase
- Slightly higher latency (extra hop to Durable Object)
- Need to manage Durable Object lifecycle

**Implementation Steps:**

1. **Create Durable Object Class:**
   ```typescript
   // src/lib/durable-objects/RateLimiter.ts
   export class RateLimiter {
     state: DurableObjectState;

     constructor(state: DurableObjectState) {
       this.state = state;
     }

     async fetch(request: Request) {
       const { identifier, limit, window } = await request.json();

       const key = `ratelimit:${identifier}`;
       const now = Date.now();
       const windowStart = now - window * 1000;

       // Get request timestamps within window
       let requests: number[] = (await this.state.storage.get(key)) || [];
       requests = requests.filter(ts => ts > windowStart);

       if (requests.length >= limit) {
         return new Response(JSON.stringify({ allowed: false }), { status: 429 });
       }

       requests.push(now);
       await this.state.storage.put(key, requests);

       return new Response(JSON.stringify({ allowed: true }), { status: 200 });
     }
   }
   ```

2. **Configure Durable Object in wrangler.toml:**
   ```toml
   [[durable_objects.bindings]]
   name = "RATE_LIMITER"
   class_name = "RateLimiter"
   script_name = "taskinfa-kanban"

   [[migrations]]
   tag = "v1"
   new_classes = ["RateLimiter"]
   ```

3. **Update Middleware:**
   ```typescript
   // src/lib/middleware/rateLimit.ts
   export async function checkRateLimitDO(
     request: NextRequest,
     identifier: string,
     limit: number,
     window: number
   ): Promise<{ allowed: boolean; resetAt?: number }> {
     const env = getRequestContext().env;
     const durableObjectId = env.RATE_LIMITER.idFromName(identifier);
     const durableObject = env.RATE_LIMITER.get(durableObjectId);

     const response = await durableObject.fetch(new Request('https://fake-host', {
       method: 'POST',
       body: JSON.stringify({ identifier, limit, window }),
     }));

     if (response.status === 429) {
       return { allowed: false, resetAt: Date.now() + window * 1000 };
     }

     return { allowed: true };
   }
   ```

4. **Update Auth Routes:**
   ```typescript
   // src/app/api/auth/login/route.ts
   const rateLimit = await checkRateLimitDO(
     request,
     `login:${request.headers.get('cf-connecting-ip')}`,
     5,  // 5 requests
     60  // per minute
   );

   if (!rateLimit.allowed) {
     throw rateLimitError(rateLimit.resetAt);
   }
   ```

### Option 3: KV-Based Rate Limiting

**Pros:**
- Simple implementation
- Works well for moderate traffic
- Free tier has generous KV limits

**Cons:**
- Eventual consistency (may allow some requests over limit)
- Higher latency than Durable Objects
- Limited accuracy for burst traffic

**Implementation Steps:**

1. **Create KV Namespace:**
   ```bash
   wrangler kv:namespace create RATE_LIMIT_KV
   ```

2. **Add to wrangler.toml:**
   ```toml
   [[kv_namespaces]]
   binding = "RATE_LIMIT_KV"
   id = "your_kv_namespace_id"
   ```

3. **Implement KV-Based Rate Limiter:**
   ```typescript
   // src/lib/middleware/rateLimit.ts
   export async function checkRateLimitKV(
     kv: KVNamespace,
     identifier: string,
     limit: number,
     window: number
   ): Promise<{ allowed: boolean; resetAt?: number }> {
     const key = `ratelimit:${identifier}`;
     const now = Date.now();
     const resetAt = now + window * 1000;

     // Get current count
     const currentCount = await kv.get(key, 'json') as { count: number; resetAt: number } | null;

     if (currentCount && currentCount.resetAt > now) {
       if (currentCount.count >= limit) {
         return { allowed: false, resetAt: currentCount.resetAt };
       }

       // Increment count
       await kv.put(key, JSON.stringify({
         count: currentCount.count + 1,
         resetAt: currentCount.resetAt,
       }), { expirationTtl: window });

       return { allowed: true };
     }

     // Start new window
     await kv.put(key, JSON.stringify({
       count: 1,
       resetAt,
     }), { expirationTtl: window });

     return { allowed: true };
   }
   ```

## Recommendation

**Use Option 1 (Cloudflare Rate Limiting API)** for production because:

1. **Simplicity** - No code changes, configured via dashboard
2. **Reliability** - Battle-tested Cloudflare infrastructure
3. **Performance** - No additional Worker execution time
4. **DDoS Protection** - Automatic protection against sophisticated attacks
5. **Compliance** - Free tier supports basic rate limiting for auth endpoints

**Fallback:** If Cloudflare Rate Limiting API is not available on the current plan, use Option 2 (Durable Objects) for accurate, stateful rate limiting.

**Not Recommended:** Option 3 (KV-Based) due to eventual consistency issues for security-critical auth endpoints.

## Implementation Timeline

**Phase 1 (Week 1):**
- Configure Cloudflare Rate Limiting rules in dashboard
- Test rate limiting on staging environment
- Document configuration in CLAUDE.md

**Phase 2 (Week 2):**
- Remove disabled rate limiting code from auth routes
- Add comments explaining Cloudflare-level rate limiting
- Update API documentation

**Phase 3 (Week 3):**
- Monitor rate limiting effectiveness
- Adjust limits based on real traffic patterns
- Set up alerts for rate limit violations

## Configuration Examples

### Login Endpoint
- **Limit:** 5 requests per minute per IP
- **Action:** Return 429 with Retry-After header
- **Bypass:** Allow authenticated requests (session cookie)

### Signup Endpoint
- **Limit:** 3 requests per 5 minutes per IP
- **Action:** Return 429 with Retry-After header
- **Additional:** CAPTCHA after 2 failures

### API Key Creation
- **Limit:** 10 requests per hour per user
- **Action:** Return 429 with error message
- **Additional:** Email notification on limit reached

## Monitoring

### Metrics to Track
- Number of rate-limited requests per endpoint
- Top IPs hitting rate limits
- Rate limit bypass attempts
- False positive rate (legitimate users blocked)

### Alerts
- Email alert when rate limit hit > 100 times in 1 hour
- Slack notification when single IP hits limit > 10 times
- Weekly report on rate limiting effectiveness

## Testing

### Manual Testing
```bash
# Test login rate limit (should fail after 5 requests)
for i in {1..10}; do
  curl -X POST https://taskinfa-kanban.secan-ltd.workers.dev/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong"}' \
    -w "\nStatus: %{http_code}\n"
done

# Test signup rate limit (should fail after 3 requests)
for i in {1..5}; do
  curl -X POST https://taskinfa-kanban.secan-ltd.workers.dev/api/auth/signup \
    -H "Content-Type: application/json" \
    -d '{"email":"test'$i'@example.com","password":"Test1234"}' \
    -w "\nStatus: %{http_code}\n"
  sleep 1
done
```

### Automated Testing
```typescript
// tests/rateLimit.test.ts
describe('Rate Limiting', () => {
  it('should block login after 5 attempts', async () => {
    const requests = Array(6).fill(null).map(() =>
      fetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com', password: 'wrong' }),
      })
    );

    const responses = await Promise.all(requests);
    const statuses = responses.map(r => r.status);

    expect(statuses.filter(s => s === 429).length).toBeGreaterThan(0);
  });
});
```

## Rollback Plan

If rate limiting causes issues:

1. **Immediate:** Disable rate limiting rules in Cloudflare dashboard
2. **Short-term:** Increase limits temporarily while investigating
3. **Long-term:** Re-enable in-memory rate limiting as stopgap (accept unreliability)

## Related Files

- `packages/dashboard/src/lib/middleware/rateLimit.ts` - Current (disabled) implementation
- `packages/dashboard/src/app/api/auth/login/route.ts` - Login endpoint
- `packages/dashboard/src/app/api/auth/signup/route.ts` - Signup endpoint
- `packages/dashboard/wrangler.toml` - Cloudflare Workers configuration

## References

- [Cloudflare Rate Limiting Docs](https://developers.cloudflare.com/waf/rate-limiting-rules/)
- [Durable Objects Rate Limiting Example](https://developers.cloudflare.com/workers/examples/durable-objects-rate-limiting/)
- [Workers KV Rate Limiting](https://developers.cloudflare.com/workers/examples/rate-limiting/)
- [Cloudflare WAF](https://developers.cloudflare.com/waf/)

---

**Last Updated:** January 27, 2026
**Author:** Implementation Plan
**Status:** Awaiting Implementation
