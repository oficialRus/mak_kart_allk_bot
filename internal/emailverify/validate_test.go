package emailverify

import "testing"

func TestNormalizeEmail(t *testing.T) {
	if got := NormalizeEmail("  Test@Example.COM  "); got != "test@example.com" {
		t.Fatalf("got %q", got)
	}
}

func TestValidateEmailFormat(t *testing.T) {
	cases := []struct {
		in   string
		want bool
	}{
		{"a@b.co", true},
		{"user+tag@domain.example", true},
		{"", false},
		{"not-an-email", false},
		{"@nodomain.com", false},
	}
	for _, c := range cases {
		if got := ValidateEmailFormat(c.in); got != c.want {
			t.Errorf("%q: got %v want %v", c.in, got, c.want)
		}
	}
}
