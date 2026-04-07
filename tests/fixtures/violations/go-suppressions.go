package main

func risky() error { return nil } //nolint:errcheck
func unsafe() { doStuff() } //nosec
