package emailverify

import "testing"

func TestHashOTP_stable(t *testing.T) {
	const secret = "test-secret"
	h1 := HashOTP(secret, "a@b.co", 42, "123456")
	h2 := HashOTP(secret, "a@b.co", 42, "123456")
	if h1 != h2 || len(h1) != 64 {
		t.Fatalf("unexpected hash len=%d h1=%s", len(h1), h1)
	}
	h3 := HashOTP(secret, "a@b.co", 42, "123457")
	if h1 == h3 {
		t.Fatal("different code should change hash")
	}
}

func TestConstantTimeEqualHash(t *testing.T) {
	if !ConstantTimeEqualHash("ab", "ab") {
		t.Fatal()
	}
	if ConstantTimeEqualHash("ab", "ac") {
		t.Fatal()
	}
	if ConstantTimeEqualHash("a", "ab") {
		t.Fatal()
	}
}
