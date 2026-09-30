/*









/*
  ============================================================
  DIALOGO INVISIBLE
  ESP8266 - Sniffer WiFi + LED por proximidad
  ============================================================

  RSSI fuerte (>= -60)  -> LED ENCENDIDO
  RSSI débil (< -60)    -> LED APAGADO

  El ESP8266 escucha Probe Requests de dispositivos WiFi
  cercanos y utiliza la intensidad de señal (RSSI) como
  aproximación de proximidad.
*/
/*
#include <ESP8266WiFi.h>

extern "C" {
  #include "user_interface.h"
}

// ------------------------------------------------------------
// CONFIGURACIÓN
// ------------------------------------------------------------

#define MAX_CACHE 60
#define COOLDOWN_MS 4000
#define CHANNEL_HOP_MS 300

// LED integrado de la LOLIN
// En esta placa LOW = encendido
//                       HIGH = apagado
#define LED_PIN LED_BUILTIN

// Umbral de proximidad
// Cuanto MENOS negativo, más fuerte es la señal.
#define RSSI_UMBRAL -60


// ------------------------------------------------------------
// ESTRUCTURA DEL RECEPTOR WIFI
// ------------------------------------------------------------

struct RxControl {
  signed rssi:8;
  unsigned rate:4;
  unsigned is_group:1;
  unsigned :27;
  unsigned sig_mode:2;
  unsigned legacy_length:12;
  unsigned damatch0:1;
  unsigned damatch1:1;
  unsigned bssidmatch0:1;
  unsigned bssidmatch1:1;
  unsigned MCS:7;
  unsigned CWB:1;
  unsigned HT_length:16;
  unsigned Smoothing:1;
  unsigned Not_Sounding:1;
  unsigned :1;
  unsigned Aggregation:1;
  unsigned STBC:2;
  unsigned FEC_CODING:1;
  unsigned SGI:1;
  unsigned rx_end_state:8;
  unsigned ampdu_cnt:8;
  unsigned channel:4;
  unsigned :12;
};


// ------------------------------------------------------------
// CACHE DE MAC
// ------------------------------------------------------------

struct SeenMac {
  uint8_t mac[6];
  unsigned long lastSeen;
};

SeenMac cache[MAX_CACHE];
int cacheCount = 0;


// ------------------------------------------------------------
// EVITAR REPETICIONES DE LA MISMA MAC
// ------------------------------------------------------------

bool alreadySeen(uint8_t *mac) {

  unsigned long now = millis();

  for (int i = 0; i < cacheCount; i++) {

    if (memcmp(cache[i].mac, mac, 6) == 0) {

      if (now - cache[i].lastSeen < COOLDOWN_MS) {
        return true;
      }

      cache[i].lastSeen = now;
      return false;
    }
  }

  int idx;

  if (cacheCount < MAX_CACHE) {
    idx = cacheCount++;
  } else {
    idx = 0;
  }

  memcpy(cache[idx].mac, mac, 6);
  cache[idx].lastSeen = now;

  return false;
}


// ------------------------------------------------------------
// CALLBACK DE CAPTURA WIFI
// ------------------------------------------------------------

void promisc_cb(uint8_t *buf, uint16_t len) {

  if (len < 12) {
    return;
  }

  RxControl *sniffer = (RxControl*) buf;

  int8_t rssi = sniffer->rssi;

  uint8_t *packet = buf + 12;

  uint16_t frameControl =
    packet[0] | (packet[1] << 8);


  // ----------------------------------------------------------
  // PROBE REQUEST
  // ----------------------------------------------------------

  if ((frameControl & 0x00FC) == 0x0040) {

    uint8_t *macBytes = &packet[10];


    // Evitar repetir demasiado la misma MAC
    if (alreadySeen(macBytes)) {
      return;
    }


    // --------------------------------------------------------
    // MAC
    // --------------------------------------------------------

    char macStr[18];

    snprintf(
      macStr,
      sizeof(macStr),
      "%02X:%02X:%02X:%02X:%02X:%02X",
      macBytes[0],
      macBytes[1],
      macBytes[2],
      macBytes[3],
      macBytes[4],
      macBytes[5]
    );


    // --------------------------------------------------------
    // SSID
    // --------------------------------------------------------

    String ssid = "BROADCAST";

    uint8_t ssidLen = packet[25];

    if (ssidLen > 0 && ssidLen < 32) {

      char ssidBuf[33];

      memset(ssidBuf, 0, sizeof(ssidBuf));

      memcpy(
        ssidBuf,
        &packet[26],
        ssidLen
      );

      ssid = String(ssidBuf);
    }


    // --------------------------------------------------------
    // MOSTRAR EN MONITOR SERIE
    // --------------------------------------------------------

    Serial.printf(
      "PROBE, %s, %d, %s\n",
      macStr,
      rssi,
      ssid.c_str()
    );


    // --------------------------------------------------------
    // LED SEGÚN RSSI
    // --------------------------------------------------------

    if (rssi >= RSSI_UMBRAL) {

      // Señal fuerte
      digitalWrite(LED_PIN, LOW);

    } else {

      // Señal débil
      digitalWrite(LED_PIN, HIGH);
    }
  }
}


// ------------------------------------------------------------
// SETUP
// ------------------------------------------------------------

void setup() {

  Serial.begin(115200);

  delay(1000);

  Serial.println();
  Serial.println("--------------------------------");
  Serial.println(" DIALOGO INVISIBLE");
  Serial.println(" ESP8266 WiFi Sniffer");
  Serial.println("--------------------------------");


  // LED
  pinMode(LED_PIN, OUTPUT);

  // LED apagado al comenzar
  digitalWrite(LED_PIN, HIGH);


  // ----------------------------------------------------------
  // MODO PROMISCUO
  // ----------------------------------------------------------

  wifi_set_opmode(STATION_MODE);

  wifi_promiscuous_enable(0);

  wifi_set_promiscuous_rx_cb(promisc_cb);

  wifi_promiscuous_enable(1);

  wifi_set_channel(1);


  Serial.println("Modo promiscuo activado.");
  Serial.println("Buscando dispositivos WiFi...");
  Serial.printf(
    "Umbral RSSI: %d dBm\n",
    RSSI_UMBRAL
  );
}


// ------------------------------------------------------------
// LOOP
// ------------------------------------------------------------

void loop() {

  // ----------------------------------------------------------
  // CAMBIO DE CANAL
  // ----------------------------------------------------------

  static unsigned long lastChannelChange = 0;

  if (millis() - lastChannelChange > CHANNEL_HOP_MS) {

    uint8_t currentChannel = wifi_get_channel();

    currentChannel = (currentChannel % 13) + 1;

    wifi_set_channel(currentChannel);

    lastChannelChange = millis();
  }
}
*/