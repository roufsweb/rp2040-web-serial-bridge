#include <stdlib.h>
#include <stdio.h>
#include <string.h>

#include "pico/stdlib.h"
#include "hardware/uart.h"
#include "hardware/irq.h"
#include "hardware/gpio.h"
#include "tusb.h"

// UART Configuration
#define UART_ID uart0
#define BAUD_RATE 115200
#define UART_TX_PIN 0
#define UART_RX_PIN 1

// Buffer for CDC to UART
static uint8_t usb_to_uart_buf[256];
static uint32_t usb_to_uart_pos = 0;

// Monitoring State
static bool possible_swap = false;
static uint32_t last_tx_activity = 0;
static bool currently_sending = false;

// Function Prototypes
void on_uart_rx();
void monitor_callback(uint gpio, uint32_t events);

int main() {
    stdio_init_all();
    tusb_init();

    // Initialize UART
    uart_init(UART_ID, BAUD_RATE);
    gpio_set_function(UART_TX_PIN, GPIO_FUNC_UART);
    gpio_set_function(UART_RX_PIN, GPIO_FUNC_UART);

    // Setup UART RX Interrupt
    irq_set_exclusive_handler(UART0_IRQ, on_uart_rx);
    irq_set_enabled(UART0_IRQ, true);
    uart_set_irq_enables(UART_ID, true, false);

    // Setup Monitoring on TX pin to detect mis-wiring
    // If we see a falling edge on TX when we are NOT sending, it's likely a swap
    gpio_set_irq_enabled_with_callback(UART_TX_PIN, GPIO_IRQ_EDGE_FALL, true, &monitor_callback);

    while (1) {
        tud_task(); // TinyUSB device task

        // UART to USB (CDC)
        if (tud_cdc_connected()) {
            if (possible_swap) {
                const char* msg = "\r\n[DIAGNOSTIC] Warning: Potential RX/TX swap detected! Activity on TX pin.\r\n";
                tud_cdc_write(msg, strlen(msg));
                tud_cdc_write_flush();
                possible_swap = false; // Reset after notifying
            }
            if (tud_cdc_available()) {
                currently_sending = true;
                uint32_t count = tud_cdc_read(usb_to_uart_buf, sizeof(usb_to_uart_buf));
                for (uint32_t i = 0; i < count; i++) {
                    uart_putc(UART_ID, usb_to_uart_buf[i]);
                }
                currently_sending = false;
            }
        }
    }

    return 0;
}

// UART RX Interrupt Handler
void on_uart_rx() {
    while (uart_is_readable(UART_ID)) {
        uint8_t ch = uart_getc(UART_ID);
        if (tud_cdc_connected()) {
            tud_cdc_write(&ch, 1);
            tud_cdc_write_flush();
        }
    }
}

// GPIO Callback for Monitoring
void monitor_callback(uint gpio, uint32_t events) {
    if (gpio == UART_TX_PIN && !currently_sending) {
        // Activity detected on TX pin while we are idle!
        possible_swap = true;
        // We could send a special message to the PC here if using a custom protocol,
        // but for standard CDC, we might just toggle an LED or wait for a status request.
    }
}

// CDC Line Coding Callback (Baud rate change)
void tud_cdc_line_coding_cb(uint8_t itf, cdc_line_coding_t const* p_line_coding) {
    uart_set_baudrate(UART_ID, p_line_coding->bit_rate);
}
