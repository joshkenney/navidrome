import { SelectInput, useTranslate } from 'react-admin'
import { useDispatch, useSelector } from 'react-redux'
import { setUiFont } from '../actions'
import { DEFAULT_FONT, DEFAULT_UI_FONT, UI_FONTS } from '../fonts'

export const SelectFont = (props) => {
  const translate = useTranslate()
  const dispatch = useDispatch()
  const current =
    useSelector((state) => state.settings?.uiFont) ?? DEFAULT_UI_FONT
  const choices = [
    { id: DEFAULT_FONT, name: translate('menu.personal.options.fontDefault') },
    ...Object.entries(UI_FONTS).map(([id, font]) => ({ id, name: font.name })),
  ]

  return (
    <SelectInput
      {...props}
      source="font"
      label={translate('menu.personal.options.font')}
      defaultValue={current}
      choices={choices}
      translateChoice={false}
      onChange={(event) => dispatch(setUiFont(event.target.value))}
    />
  )
}
