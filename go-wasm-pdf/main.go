//go:build wasm

package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"syscall/js"

	"github.com/benoitkugler/pdf/reader"
)

func main() {
	// Instantiate a channel, 'ch', with no buffer, acting as a synchronization point for the goroutine.
	ch := make(chan struct{}, 0)

	js.Global().Set("readPDFFile", js.FuncOf(readPDFFile))

	// Utilize a channel receive expression to halt the 'main' goroutine, preventing the program from terminating.
	<-ch
}

type Data struct {
	B int
}

func readPDFFile(this js.Value, input []js.Value) interface{} {
	array := input[0]
	L := array.Length()
	inSlice := make([]byte, L)
	js.CopyBytesToGo(inSlice, array)

	// TODO
	doc, _, err := reader.ParsePDFReader(bytes.NewReader(inSlice), reader.Options{})
	if err != nil {
		return err
	}
	fmt.Println(doc.Trailer.Info)

	out := Data{4}
	b, _ := json.Marshal(out)
	return string(b)
}
