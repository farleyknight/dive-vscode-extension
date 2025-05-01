package com.example.testfixture;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RestController;

@RestController // No class-level @RequestMapping
public class OrderController {

    // GET with multiple paths
    @GetMapping({"/api/orders/recent", "/api/orders/latest"})
    public String getRecentOrders() {
        return "Showing recent orders.";
    }

    // RequestMapping with specific method
    @RequestMapping(value = "/api/orders", method = RequestMethod.POST)
    public String createOrder() {
        return "Order created.";
    }

    // Simple GET mapping at the root level of this controller
    @GetMapping("/status")
    public String getStatus() {
        return "Order service is UP";
    }
}