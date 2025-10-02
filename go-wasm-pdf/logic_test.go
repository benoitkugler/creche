package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"testing"
)

func TestReadPDF(t *testing.T) {
	for i, file := range []string{
		"Planning Mensuel 0925.pdf",
		"Planning Mensuel 1025.pdf",
	} {
		b, err := os.ReadFile(file)
		if err != nil {
			t.Fatal(err)
		}
		texts, err := extractTextsInPDF(bytes.NewReader(b))
		if err != nil {
			t.Fatal(err)
		}
		// redact children
		for j, text := range texts {
			if strings.Count(text.Text, "/") >= 2 && j != 0 {
				// we have a birthday
				texts[j].Text = "XXXXXXX Aaaaaaaa" + text.Text[len(text.Text)-11:len(text.Text)]
			}
		}
		b, err = json.MarshalIndent(texts, " ", " ")
		if err != nil {
			t.Fatal(err)
		}
		err = os.WriteFile(fmt.Sprintf("../src/logic/sample_enfants_redacted_%d.json", i), b, os.ModePerm)
		if err != nil {
			t.Fatal(err)
		}
	}
}
