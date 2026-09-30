package com.rnwhisper;

import android.content.Context;
import android.content.pm.PackageManager;
import android.opengl.EGL14;
import android.opengl.EGLConfig;
import android.opengl.EGLContext;
import android.opengl.EGLDisplay;
import android.opengl.EGLSurface;
import android.opengl.GLES20;
import android.os.Build;
import android.util.Log;

import com.facebook.react.bridge.ReactApplicationContext;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileOutputStream;
import java.io.FileReader;
import java.io.IOException;
import java.io.InputStream;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class RNWhisper {
  public static final String NAME = "RNWhisper";
  private static final String TAG = "RNWhisper";
  private static boolean libsLoaded = false;

  // Hexagon (Qualcomm NPU). The DSP-side kernels ship as app assets
  // (android/build.gradle syncRNWhisperHtpAssets) and are copied to an
  // app-private directory that ADSP_LIBRARY_PATH points at, since the DSP
  // loader reads them from the filesystem rather than from the APK.
  private static final String HTP_DIR_NAME = "rnwhisper-htp";
  private static final int HTP_FILE_MODE = 0755;
  private static final String[] HTP_LIBS = {
    "libggml-htp-v73.so",
    "libggml-htp-v75.so",
    "libggml-htp-v79.so",
    "libggml-htp-v81.so"
  };
  // Same heuristics as llama.rn: SoCs whose HTP is known to work with ggml-hexagon,
  // plus a generic Snapdragon 8-series match when the device also reports Qualcomm.
  private static final Pattern QUALCOMM_HINT_PATTERN =
    Pattern.compile("(adreno|qcom|qualcomm|snapdragon)", Pattern.CASE_INSENSITIVE);
  private static final Pattern KNOWN_HEXAGON_SOC_PATTERN =
    Pattern.compile("\\b(SM8450|SM8550|SM8635|SM8650|SM8750|SM8845|SM8850)\\b");
  private static final Pattern SNAPDRAGON_8_SERIES_SOC_PATTERN = Pattern.compile("\\bSM8\\d{3}\\b");
  private static final Pattern SNAPDRAGON_8_SERIES_NAME_PATTERN = Pattern.compile("SNAPDRAGON\\s*8");
  private static final Pattern HEXAGON_CODENAME_PATTERN = Pattern.compile("(taro|kalama|pineapple|sun|lanai)");

  // Each variant is a pair of libraries: librnwhisper_jni<suffix>.so, the JNI/JSI
  // wrapper built against the app's React Native, and librnwhisper<suffix>.so,
  // the whisper.cpp core it depends on (prebuilt or built from source, see
  // android/src/main/CMakeLists.txt). Loading the wrapper pulls the core in.
  private static boolean tryLoadLibrary(String library) {
    try {
      System.loadLibrary(library);
      Log.d(TAG, "Loaded native library: " + library);
      return true;
    } catch (UnsatisfiedLinkError error) {
      Log.w(TAG, "Unable to load native library " + library, error);
      return false;
    }
  }

  /** Accelerators a variant can carry; see {@link #acceleration}. */
  public static final String ACCELERATION_HEXAGON = "hexagon";
  public static final String ACCELERATION_VULKAN = "vulkan";
  public static final String ACCELERATION_CPU = "cpu";

  private static String acceleration;
  private static String gpuName;

  /**
   * The accelerator of the variant this device loads: {@link #ACCELERATION_HEXAGON}
   * on Snapdragon SoCs whose NPU ggml-hexagon supports, {@link #ACCELERATION_VULKAN}
   * on the GPUs the Vulkan variant is tuned for (see {@link #isVulkanGpuSupported}),
   * otherwise {@link #ACCELERATION_CPU}. Loading follows this choice, so an app can
   * use it to decide what to run before loading anything.
   */
  public static synchronized String acceleration(Context context) {
    if (acceleration == null) {
      acceleration = detectAcceleration(context);
      Log.i(TAG, "Acceleration: " + acceleration + (gpuName != null ? " (" + gpuName + ")" : ""));
    }
    return acceleration;
  }

  /** The GPU's name (GL_RENDERER) when it was probed, else null. */
  public static synchronized String gpuName(Context context) {
    acceleration(context);
    return gpuName;
  }

  private static String detectAcceleration(Context context) {
    if (!isArm64V8a()) {
      return ACCELERATION_CPU;
    }
    String cpuFeatures = getCpuFeatures();
    boolean hasFp16 = cpuFeatures.contains("fp16") || cpuFeatures.contains("fphp");
    if (!hasFp16) {
      return ACCELERATION_CPU;
    }
    if (isHexagonSupported()) {
      return ACCELERATION_HEXAGON;
    }
    if (hasVulkan11(context)) {
      gpuName = glRenderer();
      if (isVulkanGpuSupported(gpuName)) {
        return ACCELERATION_VULKAN;
      }
    }
    return ACCELERATION_CPU;
  }

  // The Vulkan variant's ggml backend runs on Vulkan 1.2 devices and on 1.1
  // devices that expose the promoted 1.2 features as extensions (Mali-G78 in a
  // Galaxy S21 reports 1.1). The system feature carries the device's version.
  private static final int VULKAN_1_1 = 0x401000;

  private static boolean hasVulkan11(Context context) {
    return context.getPackageManager()
      .hasSystemFeature(PackageManager.FEATURE_VULKAN_HARDWARE_VERSION, VULKAN_1_1);
  }

  private static final Pattern MALI_PATTERN = Pattern.compile("^Mali-G(\\d+)");

  /**
   * Arm Mali GPUs of the Valhall architecture and later (Mali-G57/G68/G77/G78,
   * G310 and up, Mali-G1, Immortalis): 16-lane subgroups and fp16 arithmetic,
   * which ggml-vulkan's Mali kernels are written for. Other GPUs (Bifrost Mali,
   * Adreno, Xclipse, PowerVR) have not been measured with it and stay on the CPU.
   */
  static boolean isVulkanGpuSupported(String renderer) {
    if (renderer == null) {
      return false;
    }
    if (renderer.startsWith("Immortalis-") || renderer.startsWith("Mali-G1-")) {
      return true;
    }
    Matcher mali = MALI_PATTERN.matcher(renderer);
    if (!mali.find()) {
      return false;
    }
    int model = Integer.parseInt(mali.group(1));
    return model == 57 || model == 68 || model == 77 || model == 78 || model >= 300;
  }

  // Vulkan has no Java binding; the GL renderer string names the same GPU. A
  // throwaway 1x1 pbuffer context is enough to read it.
  private static String glRenderer() {
    EGLDisplay display = EGL14.eglGetDisplay(EGL14.EGL_DEFAULT_DISPLAY);
    if (display == EGL14.EGL_NO_DISPLAY || !EGL14.eglInitialize(display, null, 0, null, 0)) {
      return null;
    }
    EGLContext eglContext = EGL14.EGL_NO_CONTEXT;
    EGLSurface surface = EGL14.EGL_NO_SURFACE;
    try {
      int[] configAttributes = {
        EGL14.EGL_RENDERABLE_TYPE, EGL14.EGL_OPENGL_ES2_BIT,
        EGL14.EGL_SURFACE_TYPE, EGL14.EGL_PBUFFER_BIT,
        EGL14.EGL_NONE
      };
      EGLConfig[] configs = new EGLConfig[1];
      int[] count = new int[1];
      if (!EGL14.eglChooseConfig(display, configAttributes, 0, configs, 0, 1, count, 0) || count[0] == 0) {
        return null;
      }
      int[] contextAttributes = { EGL14.EGL_CONTEXT_CLIENT_VERSION, 2, EGL14.EGL_NONE };
      eglContext = EGL14.eglCreateContext(display, configs[0], EGL14.EGL_NO_CONTEXT, contextAttributes, 0);
      int[] surfaceAttributes = { EGL14.EGL_WIDTH, 1, EGL14.EGL_HEIGHT, 1, EGL14.EGL_NONE };
      surface = EGL14.eglCreatePbufferSurface(display, configs[0], surfaceAttributes, 0);
      if (eglContext == EGL14.EGL_NO_CONTEXT || surface == EGL14.EGL_NO_SURFACE
          || !EGL14.eglMakeCurrent(display, surface, surface, eglContext)) {
        return null;
      }
      return GLES20.glGetString(GLES20.GL_RENDERER);
    } finally {
      EGL14.eglMakeCurrent(display, EGL14.EGL_NO_SURFACE, EGL14.EGL_NO_SURFACE, EGL14.EGL_NO_CONTEXT);
      if (surface != EGL14.EGL_NO_SURFACE) {
        EGL14.eglDestroySurface(display, surface);
      }
      if (eglContext != EGL14.EGL_NO_CONTEXT) {
        EGL14.eglDestroyContext(display, eglContext);
      }
      EGL14.eglTerminate(display);
    }
  }

  public static synchronized boolean loadNative(ReactApplicationContext context) {
    if (libsLoaded) {
      return true;
    }

    if (Build.SUPPORTED_ABIS.length == 0) {
      Log.w(TAG, "No supported ABIs reported by the runtime");
      return false;
    }

    String cpuFeatures = getCpuFeatures();
    boolean hasFp16 = cpuFeatures.contains("fp16") || cpuFeatures.contains("fphp");
    String accelerator = acceleration(context);

    try {
      if (isArm64V8a()) {
        if (accelerator.equals(ACCELERATION_HEXAGON) && prepareHexagon(context)
            && tryLoadLibrary("rnwhisper_jni_v8fp16_va_2_hexagon")) {
          libsLoaded = true;
          return true;
        }

        if (accelerator.equals(ACCELERATION_VULKAN)
            && tryLoadLibrary("rnwhisper_jni_v8fp16_va_2_vulkan")) {
          libsLoaded = true;
          return true;
        }

        if (hasFp16 && tryLoadLibrary("rnwhisper_jni_v8fp16_va_2")) {
          libsLoaded = true;
          return true;
        }

        if (tryLoadLibrary("rnwhisper_jni_v8")) {
          libsLoaded = true;
          return true;
        }
      } else if (isArmeabiV7a()) {
        if (tryLoadLibrary("rnwhisper_jni_vfpv4")) {
          libsLoaded = true;
          return true;
        }
      } else if (isX86_64()) {
        if (tryLoadLibrary("rnwhisper_jni_x86_64")) {
          libsLoaded = true;
          return true;
        }
      }

      if (tryLoadLibrary("rnwhisper_jni")) {
        libsLoaded = true;
      }
    } catch (UnsatisfiedLinkError error) {
      Log.e(TAG, "Failed to load RNWhisper native library", error);
      libsLoaded = false;
    }

    return libsLoaded;
  }

  private static boolean isArm64V8a() {
    return Build.SUPPORTED_ABIS.length > 0
      && Build.SUPPORTED_ABIS[0].equals("arm64-v8a");
  }

  private static boolean isArmeabiV7a() {
    return Build.SUPPORTED_ABIS.length > 0
      && Build.SUPPORTED_ABIS[0].equals("armeabi-v7a");
  }

  private static boolean isX86_64() {
    return Build.SUPPORTED_ABIS.length > 0
      && Build.SUPPORTED_ABIS[0].equals("x86_64");
  }

  // Extracts the HTP libraries and points ADSP_LIBRARY_PATH at them. Returns
  // false when the app does not bundle them, in which case the CPU variant is
  // loaded instead.
  private static boolean prepareHexagon(Context context) {
    File htpDir;
    try {
      htpDir = context.getDir(HTP_DIR_NAME, Context.MODE_PRIVATE);
    } catch (Exception error) {
      Log.w(TAG, "Unable to create the HTP directory; using CPU", error);
      return false;
    }

    for (String libName : HTP_LIBS) {
      File outFile = new File(htpDir, libName);
      try (InputStream in = context.getAssets().open("ggml-hexagon/" + libName);
           FileOutputStream out = new FileOutputStream(outFile)) {
        byte[] buffer = new byte[64 * 1024];
        int read;
        while ((read = in.read(buffer)) != -1) {
          out.write(buffer, 0, read);
        }
      } catch (IOException error) {
        Log.w(TAG, "HTP library " + libName + " not bundled in assets/ggml-hexagon; using CPU");
        return false;
      }
      outFile.setReadable(true, false);
      outFile.setExecutable(true, false);
      try {
        android.system.Os.chmod(outFile.getAbsolutePath(), HTP_FILE_MODE);
      } catch (Exception error) {
        Log.w(TAG, "Failed to chmod " + outFile.getAbsolutePath(), error);
      }
    }

    try {
      android.system.Os.setenv("ADSP_LIBRARY_PATH", htpDir.getAbsolutePath(), true);
      // whisper.cpp uses a single GPU-class device, so one HTP session is enough.
      android.system.Os.setenv("GGML_HEXAGON_DEVICES", "1", false);
    } catch (Exception error) {
      Log.w(TAG, "Failed to set ADSP_LIBRARY_PATH; using CPU", error);
      return false;
    }
    Log.d(TAG, "HTP libraries extracted to " + htpDir.getAbsolutePath());
    return true;
  }

  private static String lowerOrEmpty(String value) {
    return value == null ? "" : value.toLowerCase(Locale.ROOT);
  }

  private static String upperOrEmpty(String value) {
    return value == null ? "" : value.toUpperCase(Locale.ROOT);
  }

  private static boolean hasQualcommDeviceHint() {
    StringBuilder hints = new StringBuilder();
    hints
      .append(lowerOrEmpty(Build.HARDWARE)).append(' ')
      .append(lowerOrEmpty(Build.BOARD)).append(' ')
      .append(lowerOrEmpty(Build.MANUFACTURER)).append(' ')
      .append(lowerOrEmpty(Build.BRAND)).append(' ')
      .append(lowerOrEmpty(Build.MODEL));

    if (Build.VERSION.SDK_INT >= 31) {
      hints.append(' ')
        .append(lowerOrEmpty(Build.SOC_MANUFACTURER)).append(' ')
        .append(lowerOrEmpty(Build.SOC_MODEL));
    }

    return QUALCOMM_HINT_PATTERN.matcher(hints.toString()).find();
  }

  private static boolean isHexagonSupported() {
    boolean hasQualcommHint = hasQualcommDeviceHint();

    if (Build.VERSION.SDK_INT >= 31) {
      String socModel = upperOrEmpty(Build.SOC_MODEL);
      if (!socModel.isEmpty()) {
        if (KNOWN_HEXAGON_SOC_PATTERN.matcher(socModel).find()) {
          return true;
        }
        if (hasQualcommHint &&
            (SNAPDRAGON_8_SERIES_SOC_PATTERN.matcher(socModel).find() ||
             SNAPDRAGON_8_SERIES_NAME_PATTERN.matcher(socModel).find())) {
          return true;
        }
      }
    }

    String hardwareHints = lowerOrEmpty(Build.HARDWARE) + " " + lowerOrEmpty(Build.BOARD);
    return hasQualcommHint && HEXAGON_CODENAME_PATTERN.matcher(hardwareHints).find();
  }

  private static String getCpuFeatures() {
    File file = new File("/proc/cpuinfo");
    StringBuilder builder = new StringBuilder();
    try (BufferedReader bufferedReader = new BufferedReader(new FileReader(file))) {
      String line;
      while ((line = bufferedReader.readLine()) != null) {
        if (line.startsWith("Features")) {
          builder.append(line);
          break;
        }
      }
      return builder.toString();
    } catch (IOException error) {
      Log.w(TAG, "Couldn't read /proc/cpuinfo", error);
      return "";
    }
  }
}
