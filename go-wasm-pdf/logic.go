package main

import (
	"errors"
	"fmt"
	"io"

	"github.com/benoitkugler/pdf/contentstream"
	"github.com/benoitkugler/pdf/fonts/simpleencodings"
	"github.com/benoitkugler/pdf/model"
	"github.com/benoitkugler/pdf/reader"
	"github.com/benoitkugler/pdf/reader/parser"
)

type TextBlock struct {
	X, Y model.Fl
	Text string
}

func extractTextsInPDF(r io.ReadSeeker) ([]TextBlock, error) {
	doc, _, err := reader.ParsePDFReader(r, reader.Options{})
	if err != nil {
		return nil, fmt.Errorf("reading pdf: %s", err)
	}
	pages := doc.Catalog.Pages.FlattenInherit()
	if len(pages) != 1 {
		return nil, fmt.Errorf("expecting 1 page, got %d", len(pages))
	}
	page := pages[0]
	content, err := page.DecodeAllContents()
	if err != nil {
		return nil, fmt.Errorf("decoding page: %s", err)
	}
	ops, err := parser.ParseContent(content, page.Resources.ColorSpace)
	if err != nil {
		return nil, fmt.Errorf("decoding graphical operations: %s", err)
	}
	fontMap := page.Resources.Font
	// to sipmplify the text decoding logic,
	// we assume all the fonts have the same encoding (WinAnsi)
	encoding := simpleencodings.WinAnsi.ByteToRune()
	var texts []TextBlock
	var currentText TextBlock
	for _, op := range ops {
		switch op := op.(type) {
		case contentstream.OpBeginText:
			currentText = TextBlock{}
		case contentstream.OpEndText:
			texts = append(texts, currentText)
		case contentstream.OpSetTextMatrix:
			currentText.X, currentText.Y = op.Matrix[5], op.Matrix[4] // the pdf has inverted dimension
		case contentstream.OpSetFont:
			// check our assumption on encoding is correct
			font := fontMap[op.Font]
			simple, ok := font.Subtype.(model.FontSimple)
			if !ok {
				return nil, errors.New("composite font not supported")

			}
			if enc := simple.SimpleEncoding(); enc != model.WinAnsiEncoding {
				return nil, fmt.Errorf("unsupport encoding %s", enc)
			}
		case contentstream.OpShowText:
			currentText.Text += op.Text
		case contentstream.OpShowSpaceText:
			var runes []rune
			for _, run := range op.Texts {
				for _, code := range run.CharCodes {
					r := encoding[code]
					runes = append(runes, r)
				}
			}
			currentText.Text += string(runes)
		case contentstream.OpTextMove:
			// simplify by adding a space
			currentText.Text += " "
		case contentstream.OpTextNextLine:
			currentText.Text += "\n"
		case contentstream.OpShowSpaceGlyph, contentstream.OpMoveShowText, contentstream.OpMoveSetShowText:
			return nil, errors.New("unhandled text operator")
			// default:
			// 	fmt.Printf("%v %T\n", op, op)
		}
	}

	return texts, nil
}
