package main

import (
	"bytes"
	"encoding/json"
	"os"
	"testing"
)

func TestReadPDF(t *testing.T) {
	b, err := os.ReadFile("Planning Mensuel 0925.pdf")
	if err != nil {
		t.Fatal(err)
	}
	texts, err := extractTextsInPDF(bytes.NewReader(b))
	if err != nil {
		t.Fatal(err)
	}
	b, err = json.MarshalIndent(texts, " ", " ")
	if err != nil {
		t.Fatal(err)
	}
	err = os.WriteFile("../src/logic/sample_enfants.json", b, os.ModePerm)
	if err != nil {
		t.Fatal(err)
	}
}
