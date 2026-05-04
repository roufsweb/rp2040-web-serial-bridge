# SPDX-License-Identifier: MIT

cmake_minimum_required(VERSION 3.13)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

# Set PICO_SDK_PATH if not set in environment
if(NOT DEFINED ENV{PICO_SDK_PATH})
    set(ENV{PICO_SDK_PATH} "/home/rouf/hardware-project/rp2040-usb-to-ttl/sdk/pico-sdk")
endif()

include(pico_sdk_import.cmake)

project(rp2040_web_serial_bridge)

pico_sdk_init()

add_executable(web_serial_bridge 
    src/main.c 
    src/usb_descriptors.c
)

target_include_directories(web_serial_bridge PUBLIC
    src/
    include/
)

target_link_libraries(web_serial_bridge
    pico_stdlib
    tinyusb_device
    hardware_uart
    hardware_gpio
    hardware_pio
    hardware_flash
    pico_util
)

pico_add_extra_outputs(web_serial_bridge)

# Enable USB CDC
target_compile_definitions(web_serial_bridge PRIVATE
    CFG_TUSB_MCU=OPT_MCU_RP2040
    PICO_BOARD="pico"
)
