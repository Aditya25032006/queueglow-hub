using System;
using System.Runtime.InteropServices;
[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
class MMDeviceEnumerator { }
[ComImport, Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceEnumerator {
 void EnumAudioEndpoints(int dataFlow, int stateMask, out IntPtr devices);
 void GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice device);
 void GetDevice([MarshalAs(UnmanagedType.LPWStr)] string id, out IMMDevice device);
 void RegisterEndpointNotificationCallback(IntPtr callback);
 void UnregisterEndpointNotificationCallback(IntPtr callback);
}
[ComImport, Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDevice {
 void Activate(ref Guid iid, int clsctx, IntPtr activationParams, [MarshalAs(UnmanagedType.Interface)] out object result);
 void OpenPropertyStore(int access, out IntPtr store);
 void GetId(out IntPtr id);
 void GetState(out int state);
}
[ComImport, Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioEndpointVolume {
 void RegisterControlChangeNotify(IntPtr callback);
 void UnregisterControlChangeNotify(IntPtr callback);
 void GetChannelCount(out int channels);
 void SetMasterVolumeLevel(float level, IntPtr context);
 void SetMasterVolumeLevelScalar(float level, IntPtr context);
 void GetMasterVolumeLevel(out float level);
 void GetMasterVolumeLevelScalar(out float level);
 void SetChannelVolumeLevel(int channel, float level, IntPtr context);
 void SetChannelVolumeLevelScalar(int channel, float level, IntPtr context);
 void GetChannelVolumeLevel(int channel, out float level);
 void GetChannelVolumeLevelScalar(int channel, out float level);
 void SetMute(bool mute, IntPtr context);
 void GetMute(out bool mute);
}
public class VolumeControl {
 public static float Read() {
  var enumerator = (IMMDeviceEnumerator)new MMDeviceEnumerator();
  IMMDevice device; enumerator.GetDefaultAudioEndpoint(0, 0, out device);
  var iid = typeof(IAudioEndpointVolume).GUID;
  object value; device.Activate(ref iid, 23, IntPtr.Zero, out value);
  var volume = (IAudioEndpointVolume)value;
  float level; volume.GetMasterVolumeLevelScalar(out level);
  return level;
 }
 public static float Write(float level) {
  if (level < 0 || level > 1) throw new ArgumentOutOfRangeException("level");
  var enumerator = (IMMDeviceEnumerator)new MMDeviceEnumerator();
  IMMDevice device; enumerator.GetDefaultAudioEndpoint(0, 0, out device);
  var iid = typeof(IAudioEndpointVolume).GUID;
  object value; device.Activate(ref iid, 23, IntPtr.Zero, out value);
  var volume = (IAudioEndpointVolume)value;
  volume.SetMasterVolumeLevelScalar(level, IntPtr.Zero);
  return level;
 }
}
