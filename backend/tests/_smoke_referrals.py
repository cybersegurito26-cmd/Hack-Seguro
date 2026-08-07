"""Quick referral E2E smoke test."""
import json, time
import urllib.request, urllib.error

BASE = "http://localhost:8001/api"

def req(method, path, body=None, token=None):
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Content-Type": "application/json"} if body is not None else {}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    r = urllib.request.Request(BASE + path, method=method, data=data, headers=headers)
    try:
        with urllib.request.urlopen(r, timeout=15) as resp:
            return resp.status, json.loads(resp.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        try:
            b = json.loads(e.read().decode() or "{}")
        except Exception:
            b = {}
        return e.code, b

ts = int(time.time())
INV_EMAIL = f"inviter+{ts}@example.com"
INVITEE_EMAIL = f"invitee+{ts}@example.com"
PW = "Segur1sim@2026"

# Inviter registers
s, r = req("POST", "/auth/register", {"name": "Ana Inviter", "email": INV_EMAIL, "password": PW, "role": "student"})
print("inviter register:", s, r.get("user", {}).get("user_id"), "valid=", r.get("user", {}).get("referrals_valid"))
inviter_token = r["session_token"]
inviter_id = r["user"]["user_id"]

# Check /referrals/mine
s, r = req("GET", "/referrals/mine", token=inviter_token)
print("referrals/mine (inicial):", s, {k: v for k, v in r.items() if k != "invitees"})
share_url = r.get("share_url")
print("share_url:", share_url)

# Invitee registers WITH ref
s, r = req("POST", "/auth/register", {"name": "Beto Invitee", "email": INVITEE_EMAIL, "password": PW, "role": "student", "ref": inviter_id})
print("invitee register w/ ref:", s, r.get("user", {}).get("user_id"), "invited_by=", r.get("user", {}).get("invited_by_user_id"))
invitee_token = r["session_token"]

# Inviter checks — should show 1 pending
s, r = req("GET", "/referrals/mine", token=inviter_token)
print("referrals/mine after invitee signup:", s, "valid=", r.get("valid"), "pending=", r.get("pending"))

# Invitee joins school
s, _ = req("POST", "/schools/join", {"school_code": "DEMO-001"}, token=invitee_token)
print("invitee joins school:", s)

# Invitee completes a lesson
s, r = req("POST", "/lessons/complete", {"module_id": "passwords", "correct": 5, "total": 5}, token=invitee_token)
print("invitee lesson complete:", s, "xp+", r.get("xp"))

# Inviter checks — should now show 1 valid, 0 pending
s, r = req("GET", "/referrals/mine", token=inviter_token)
print("referrals/mine after invitee lesson:", s, "valid=", r.get("valid"), "pending=", r.get("pending"), "goals=", r.get("goals"))

# Complete another lesson from same invitee — should NOT count twice
s, _ = req("POST", "/lessons/complete", {"module_id": "phishing", "correct": 3, "total": 5}, token=invitee_token)
print("invitee second lesson:", s)
s, r = req("GET", "/referrals/mine", token=inviter_token)
print("referrals/mine (should be still 1 valid):", s, "valid=", r.get("valid"))

# Simulate 3 more invitees to trigger embajador_digital
for i in range(3):
    e = f"friend{i}+{ts}@example.com"
    s, r = req("POST", "/auth/register", {"name": f"Amigo {i}", "email": e, "password": PW, "role": "student", "ref": inviter_id})
    tok = r["session_token"]
    req("POST", "/schools/join", {"school_code": "DEMO-001"}, token=tok)
    req("POST", "/lessons/complete", {"module_id": "phishing", "correct": 4, "total": 5}, token=tok)
s, r = req("GET", "/auth/me", token=inviter_token)
print("inviter after 4 valid:", s, "valid=", r["user"].get("referrals_valid"), "badges=", r["user"].get("badges"))

# Try self-referral (should be ignored)
s, r = req("POST", "/auth/register", {"name": "Malicioso", "email": f"self+{ts}@example.com", "password": PW, "role": "student", "ref": None})
new_id = r["user"]["user_id"]
new_tok = r["session_token"]
s2, r2 = req("POST", "/auth/register", {"name": "X", "email": f"other+{ts}@example.com", "password": PW, "role": "student", "ref": "user_nonexistent"})
print("register with bogus ref:", s2, "invited_by=", r2["user"].get("invited_by_user_id"))

# join landing with ref
import urllib.request
resp = urllib.request.urlopen(f"http://localhost:8001/api/join?code=DEMO-001&ref={inviter_id}", timeout=10)
html = resp.read().decode()
print("join landing has inviter name:", "Ana" in html, "school:", "Escuela Demo" in html)
