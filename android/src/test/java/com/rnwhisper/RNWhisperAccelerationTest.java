package com.rnwhisper;

import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class RNWhisperAccelerationTest {
  @Test
  public void hexagonOnSocsWithAnHtpLibrary() {
    assertTrue(RNWhisper.isHexagonSoc("SM8550", true)); // 8 Gen 2, HTP v73
    assertTrue(RNWhisper.isHexagonSoc("SM8635", false)); // 8s Gen 3
    assertTrue(RNWhisper.isHexagonSoc("SM8650", true)); // 8 Gen 3, v75
    assertTrue(RNWhisper.isHexagonSoc("SM8750", true)); // 8 Elite, v79
    assertTrue(RNWhisper.isHexagonSoc("SM8950", true)); // a newer 8-series SoC
  }

  @Test
  public void noHexagonWithoutAnHtpLibrary() {
    assertFalse(RNWhisper.isHexagonSoc("SM8450", true)); // 8 Gen 1, HTP v69
    assertFalse(RNWhisper.isHexagonSoc("SM8475", true)); // 8+ Gen 1, v69
    assertFalse(RNWhisper.isHexagonSoc("SM8350", true)); // 888
    assertFalse(RNWhisper.isHexagonSoc("SM7550", true));
    assertFalse(RNWhisper.isHexagonSoc("SM8950", false)); // unlisted without a Qualcomm hint
    assertFalse(RNWhisper.isHexagonSoc("S5E9840", false)); // Exynos 2400
  }

  @Test
  public void vulkanOnMaliValhallAndLater() {
    assertTrue(RNWhisper.isVulkanGpuSupported("Mali-G78"));
    assertTrue(RNWhisper.isVulkanGpuSupported("Mali-G57 MC2"));
    assertTrue(RNWhisper.isVulkanGpuSupported("Mali-G710"));
    assertTrue(RNWhisper.isVulkanGpuSupported("Immortalis-G925"));
    assertTrue(RNWhisper.isVulkanGpuSupported("Mali-G1-Ultra"));
  }

  @Test
  public void noVulkanElsewhere() {
    assertFalse(RNWhisper.isVulkanGpuSupported("Mali-G76")); // Bifrost
    assertFalse(RNWhisper.isVulkanGpuSupported("Mali-G52"));
    assertFalse(RNWhisper.isVulkanGpuSupported("Adreno (TM) 740")); // stock ggml-vulkan fails on it
    assertFalse(RNWhisper.isVulkanGpuSupported("Samsung Xclipse 940"));
    assertFalse(RNWhisper.isVulkanGpuSupported(null));
  }
}
