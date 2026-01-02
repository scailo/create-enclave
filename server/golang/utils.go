package main

import "fmt"

func getEnclavePrefix(enclaveName string) string {
	return fmt.Sprintf("/enclave/%s", enclaveName)
}
