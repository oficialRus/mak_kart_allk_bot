package identity

import "testing"

func TestRanges(t *testing.T) {
	if !IsTelegramID(12345) {
		t.Fatal("expected 12345 as telegram id")
	}
	if IsTelegramID(MinEmailOnlyUserID) {
		t.Fatal("10^10 must not be treated as historical telegram_id")
	}
	if IsTelegramID(-1) {
		t.Fatal("negative is not telegram")
	}
	if !IsSyntheticCabinetDeviceID(-1) {
		t.Fatal("negative = synthetic cabinet")
	}
	if !IsEmailOnlyUserID(MinEmailOnlyUserID) {
		t.Fatal("min email-only boundary")
	}
}
