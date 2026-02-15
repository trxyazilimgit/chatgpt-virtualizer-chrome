# ChatGPT Virtualizer

ChatGPT'de uzun konuşmalar sırasında tarayıcının yavaşlamasını önleyen bir Chrome eklentisi.

## Sorun

ChatGPT, konuşmadaki tüm mesajları DOM'da tutar. Yüzlerce mesaj içeren uzun sohbetlerde bu durum tarayıcının bellek kullanımını artırır, scroll'u yavaşlatır ve genel performansı düşürür.

## Çözüm

Eklenti, ekranda görünmeyen mesajları DOM'dan çıkarıp bellekte hafif bir şekilde tutar. Mesaj tekrar görünür hale geldiğinde anında geri yüklenir.

- **IntersectionObserver** ile mesajların görünürlüğünü izler
- Görünmeyen mesajların DOM node'larını `DocumentFragment`'e taşır (HTML parse maliyeti sıfır)
- Mesaj ekrana geldiğinde node'ları tek operasyonla geri bağlar
- Son 3 mesaj ve aktif streaming mesajı her zaman korunur
- Konuşmalar arası geçişlerde otomatik sıfırlanır

## Kurulum

1. Bu repoyu klonlayın veya ZIP olarak indirin:
   ```
   git clone https://github.com/trxyazilimgit/chromegpt.git
   ```

2. Chrome'da `chrome://extensions` adresine gidin

3. Sağ üst köşeden **Geliştirici modu**'nu açın

4. **Paketlenmemiş öğe yükle** butonuna tıklayın

5. İndirdiğiniz `chromegpt` klasörünü seçin

6. [chatgpt.com](https://chatgpt.com) adresine gidin — eklenti otomatik çalışmaya başlar

## Kullanım

Araç çubuğundaki eklenti ikonuna tıklayarak popup'ı açın:

- **Virtualization** toggle'ı ile eklentiyi açıp kapatın
- **Ring chart** ile kaç mesajın virtualize edildiğini görün
- **Buffer zone** slider'ı ile görünürlük tampon bölgesini ayarlayın (1000px–5000px)

## Dosya Yapısı

```
chromegpt/
├── manifest.json   # Chrome Extension Manifest V3
├── content.js      # Virtualization mantığı (content script)
├── popup.html      # Popup arayüzü
├── popup.js        # Popup kontrolü
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

## Lisans

MIT

## Geliştirici

[trxyazilimgit](https://github.com/trxyazilimgit)
