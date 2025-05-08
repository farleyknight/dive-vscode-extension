package com.example.testfixture;

public class TestModel {
    private String id;
    private String name;
    private int value;
    private boolean active;

    public TestModel(String id, String name, int value, boolean active) {
        this.id = id;
        this.name = name;
        this.value = value;
        this.active = active;
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public int getValue() {
        return value;
    }

    public void setValue(int value) {
        this.value = value;
    }

    public boolean isActive() {
        return active;
    }

    public void setActive(boolean active) {
        this.active = active;
    }

    @Override
    public String toString() {
        return "TestModel{" +
                "id='" + id + '\'' +
                ", name='" + name + '\'' +
                ", value=" + value +
                ", active=" + active +
                '}';
    }
}