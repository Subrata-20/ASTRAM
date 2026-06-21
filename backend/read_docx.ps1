$word = New-Object -ComObject Word.Application
$word.Visible = $false
$doc = $word.Documents.Open('c:\Users\Tapasya\Desktop\FlipkartGridlock\ASTRAM_Implementation_Plan.docx')
$text = $doc.Content.Text
$doc.Close()
$word.Quit()
$text
