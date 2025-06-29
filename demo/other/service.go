package main

import "fmt"

func calculateTotal(items []int) int {
    total := 0
    for _, item := range items {
        total += item
    }
    return total
}

func main() {
    items := []int{10, 20, 30}
    fmt.Println("Total:", calculateTotal(items))
}