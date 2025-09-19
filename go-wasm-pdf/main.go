//go:build wasm

// GOOS=js GOARCH=wasm go build -o main.wasm
package main

import (
	"bytes"
	"encoding/json"
	"syscall/js"
)

func main() {
	// Instantiate a channel, 'ch', with no buffer, acting as a synchronization point for the goroutine.
	ch := make(chan struct{})

	js.Global().Set("readPDFFile", js.FuncOf(readPDFFile))

	// Utilize a channel receive expression to halt the 'main' goroutine, preventing the program from terminating.
	<-ch
}

func readPDFFile(this js.Value, input []js.Value) any {
	array := input[0]
	L := array.Length()
	inSlice := make([]byte, L)
	js.CopyBytesToGo(inSlice, array)

	texts, err := extractTextsInPDF(bytes.NewReader(inSlice))
	if err != nil {
		return err
	}

	b, _ := json.Marshal(texts)
	return string(b)
}
